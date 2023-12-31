interface Chalk {
  (text: string): string;
  bold: (text: string) => string;
}

const _chalk: Record<string, Chalk> = {};

// TODO: jest will not work with typescript and chalk without requiring every dev
//       to setup a custom jest config.  This "homerolled" coloring can probably
//       be removed if https://github.com/facebook/jest/issues/12270 is resolved
const colors = ["red", "cyan", "yellow", "magenta"];

const resetColor = "\x1b[0m";
const resetBold = "\x1b[0m";

const codes: Record<string, string> = {
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

const bold = function (text: string): string {
  // notice that we have to use a different reset code here
  return codes.bold + text + resetBold;
};

for (const color of colors) {
  const _colorFunction = function (text: string): string {
    return wrapChar(text, color);
  };
  _colorFunction.bold = function (text: string) {
    const coloredText = _chalk[color](text);
    return bold(coloredText);
  };
  _chalk[color] = _colorFunction;
}

// Doing this to keep typescript compiler happy
bold.bold = bold;
_chalk.bold = bold;

const wrapChar = function (text: string, color: string): string {
  return codes[color] + text + resetColor;
};

export const chalk = _chalk;
