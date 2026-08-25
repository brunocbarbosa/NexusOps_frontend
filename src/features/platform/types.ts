/**
 * Tipos do domínio `platform`, espelhando o contrato medido do backend
 * (`documents/backend/PLATFORM.md`, Part I).
 *
 * "Company" aqui é o que o backend chama de `Tenant`. O nome muda porque é o
 * que a tela mostra: quem opera o console vê clientes, não linhas de uma tabela
 * de multi-tenancy.
 */

import type { PageMeta } from "../identity/types";

/** `CompanyResponse` — o que toda rota que devolve uma company devolve. */
export interface Company {
  id: string;
  name: string;
  /** Pode ser nulo: o backend permite company sem domínio. */
  domain: string | null;
  /** `false` bloqueia: nenhum usuário dela consegue entrar. */
  isActive: boolean;
  createdAt: string;
}

export interface CompaniesPage {
  data: Company[];
  meta: PageMeta;
}

export interface CompaniesQuery {
  page: number;
  perPage: number;
  search?: string;
  /**
   * `undefined` significa **as duas**, e é assim que se diz isso: não existe
   * valor para "ambas" — `''` e `'all'` são 400 no backend.
   */
  isActive?: boolean;
}

/**
 * O corpo de `POST /platform/companies`.
 *
 * O primeiro ADMIN vem junto e não é opcional: uma company sem ADMIN é uma em
 * que ninguém entra, ninguém cria o primeiro usuário, e a guarda do "último
 * ADMIN" nunca pode ser satisfeita. Não há rota de saída desse estado.
 */
export interface CreateCompanyInput {
  name: string;
  domain: string;
  admin: { email: string; password: string };
}

/**
 * O 201.
 *
 * **Não vem token.** O operador criou a company; não virou administrador dela.
 * O `admin` aqui é a única vez que aquelas credenciais aparecem — não há email
 * de convite nem reset de senha.
 */
export interface CreateCompanyResult {
  company: Company;
  admin: { id: string; email: string; role: string; createdAt: string };
}

export interface UpdateCompanyInput {
  id: string;
  name?: string;
  domain?: string;
  isActive?: boolean;
}
