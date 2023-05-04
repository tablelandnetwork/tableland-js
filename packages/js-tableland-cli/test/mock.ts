export const getResolverMock = async (): Promise<any> => {
  return {
    getText: async () => "healthbot_31337_1",
  };
};
