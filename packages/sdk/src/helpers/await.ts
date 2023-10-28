/**
 * A type that can be awaited.
 * @property T The type to await.
 */
export type Awaitable<T> = T | PromiseLike<T>;

/**
 * A signal to abort a request.
 */
export interface Signal {
  /**
   * The {@link AbortSignal} to abort a request.
   */
  signal: AbortSignal;
  /**
   * A function to abort a request.
   */
  abort: () => void;
}

/**
 * A polling interval to check for results.
 */
export interface Interval {
  /**
   * The interval period to make new requests, in milliseconds.
   */
  interval: number;
  /**
   * A function to cancel a polling interval.
   */
  cancel: () => void;
}

/**
 * A polling timeout to abort a request.
 */
export interface Timeout {
  /**
   * The timeout period in milliseconds.
   */
  timeout: number;
}

/**
 * A polling controller with a custom timeout & interval.
 */
export type PollingController = Signal & Interval & Timeout;

/**
 * A waitable interface to check for results.
 */
export interface Wait<T = unknown> {
  /**
   * A function to check for results.
   * @param controller A {@link PollingController} with the custom timeout & interval.
   * @returns
   */
  wait: (controller?: PollingController) => Promise<T>;
}

/**
 * Results from an an asynchronous function.
 */
export interface AsyncData<T> {
  done: boolean;
  data?: T;
}

/**
 * An asynchronous function to check for results.
 */
export type AsyncFunction<T> = () => Awaitable<AsyncData<T>>;

/**
 * Create a signal to abort a request.
 * @returns A {@link Signal} to abort a request.
 */
export function createSignal(): Signal {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => {
      controller.abort();
    },
  };
}

/**
 * Create a polling controller with a custom timeout & interval.
 * @param timeout The timeout period in milliseconds.
 * @param interval The interval period to make new requests, in milliseconds.
 * @returns A {@link PollingController} with the custom timeout & interval.
 */
export function createPollingController(
  timeout: number = 60_000,
  pollingInterval: number = 1500
): PollingController {
  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, timeout);
  return {
    signal: controller.signal,
    abort: () => {
      clearTimeout(timeoutId);
      controller.abort();
    },
    interval: pollingInterval,
    cancel: () => {
      clearTimeout(timeoutId);
    },
    timeout,
  };
}

/**
 * Create an asynchronous poller to check for results for a given function.
 * @param fn An {@link AsyncFunction} to check for results.
 * @param controller A {@link PollingController} with the custom timeout & interval.
 * @returns Result from the awaited function's execution or resulting error.
 */
export async function getAsyncPoller<T = unknown>(
  fn: AsyncFunction<T>,
  controller?: PollingController
): Promise<T> {
  const control = controller ?? createPollingController();
  const checkCondition = (
    resolve: (value: T) => void,
    reject: (reason?: any) => void
  ): void => {
    Promise.resolve(fn())
      .then((result: AsyncData<T>) => {
        if (result.done && result.data != null) {
          // We don't want to call `AbortController.abort()` if the call succeeded
          control.cancel();
          return resolve(result.data);
        }
        if (control.signal.aborted) {
          // We don't want to call `AbortController.abort()` if the call is already aborted
          control.cancel();
          return reject(control.signal.reason);
        } else {
          setTimeout(checkCondition, control.interval, resolve, reject);
        }
      })
      .catch((err) => {
        return reject(err);
      });
  };
  return await new Promise<T>(checkCondition);
}
