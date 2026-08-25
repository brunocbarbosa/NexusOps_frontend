/**
 * Dublê do cookie store do Next para os testes de Route Handler.
 *
 * `cookies()` só existe dentro de uma requisição, então os testes precisam de
 * um substituto — e ele guarda as **opções** de cada cookie, não só o valor:
 * `httpOnly` é a decisão central da arquitetura de sessão e merece asserção.
 */

interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: string;
  secure?: boolean;
  path?: string;
  maxAge?: number;
}

interface StoredCookie {
  value: string;
  options: CookieOptions;
}

class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();

  get(name: string): { name: string; value: string } | undefined {
    const stored = this.cookies.get(name);

    return stored ? { name, value: stored.value } : undefined;
  }

  set(name: string, value: string, options: CookieOptions = {}): void {
    // É assim que `clearTokens()` apaga: sobrescreve com maxAge 0.
    if (options.maxAge === 0) {
      this.cookies.delete(name);
      return;
    }

    this.cookies.set(name, { value, options });
  }

  stored(name: string): StoredCookie | undefined {
    return this.cookies.get(name);
  }

  valueOf(name: string): string | undefined {
    return this.cookies.get(name)?.value;
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  reset(): void {
    this.cookies.clear();
  }
}

export const cookieJar = new CookieJar();
