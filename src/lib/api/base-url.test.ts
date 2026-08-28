/**
 * @jest-environment node
 */
import { apiBaseUrl } from "./base-url";
import { ConfigurationError } from "./errors";

const original = process.env.NEXUSOPS_API_URL;

afterEach(() => {
  if (original === undefined) {
    delete process.env.NEXUSOPS_API_URL;
  } else {
    process.env.NEXUSOPS_API_URL = original;
  }
});

describe("apiBaseUrl", () => {
  it("lança quando NEXUSOPS_API_URL não está definida", () => {
    delete process.env.NEXUSOPS_API_URL;

    expect(() => apiBaseUrl()).toThrow(/NEXUSOPS_API_URL/);
  });

  it("lança quando a variável está vazia", () => {
    process.env.NEXUSOPS_API_URL = "   ";

    expect(() => apiBaseUrl()).toThrow(/NEXUSOPS_API_URL/);
  });

  it("lança um ConfigurationError, que o route-proxy traduz em 500 e não em 502", () => {
    delete process.env.NEXUSOPS_API_URL;

    expect(() => apiBaseUrl()).toThrow(ConfigurationError);
  });

  it("devolve a URL configurada", () => {
    process.env.NEXUSOPS_API_URL = "http://localhost:3333";

    expect(apiBaseUrl()).toBe("http://localhost:3333");
  });

  it("remove a barra final, que faria o Nest responder 404 numa rota que existe", () => {
    process.env.NEXUSOPS_API_URL = "http://localhost:3333//";

    expect(apiBaseUrl()).toBe("http://localhost:3333");
  });
});
