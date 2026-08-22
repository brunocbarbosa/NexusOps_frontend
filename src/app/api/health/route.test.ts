/**
 * Route Handler roda no servidor, não no browser: o jsdom não define `Response`
 * nem o resto da Fetch API, e o teste falharia com ReferenceError antes de
 * chegar a qualquer asserção. O ambiente `node` é o que este arquivo realmente
 * exercita.
 *
 * @jest-environment node
 */
import { GET } from "./route";

describe("GET /api/health", () => {
  it("responde 200 com status ok", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("responde JSON, que é o que o HEALTHCHECK da imagem consome", () => {
    expect(GET().headers.get("content-type")).toContain("application/json");
  });
});
