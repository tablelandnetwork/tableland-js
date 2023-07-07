export const getResolverMock = async (): Promise<any> => {
  return {
    getText: async () => "healthbot_31337_1",
  };
};

export const getResolverUndefinedMock = async (): Promise<undefined> => {
  return undefined;
};
