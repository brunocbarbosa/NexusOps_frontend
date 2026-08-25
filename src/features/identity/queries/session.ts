"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { fetchJson, fetchVoid, jsonBody } from "@/lib/api/client";

import type { AuthUser, SessionUser } from "../types";
import { identityKeys } from "./keys";

/**
 * Quem está logado, segundo `GET /auth/me`.
 *
 * É a única fonte de papel da interface. O JWT também carrega `role`, mas o
 * backend relê a linha do usuário a cada requisição: quem foi rebaixado há
 * trinta segundos ainda teria ADMIN no token por até 15 minutos.
 */
export function useSession() {
  return useQuery({
    queryKey: identityKeys.session,
    queryFn: () => fetchJson<SessionUser>("/api/auth/me"),
    staleTime: 60_000,
  });
}

export interface Credentials {
  tenantDomain: string;
  email: string;
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: Credentials) =>
      fetchJson<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        ...jsonBody(credentials),
      }),
    onSuccess: () => {
      // Zera o cache antes de entrar: numa máquina compartilhada, o que sobrou
      // da sessão anterior é dado de outro tenant.
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => fetchVoid("/api/auth/logout", { method: "POST" }),
    onSettled: () => {
      // `onSettled`, não `onSuccess`: se a API não responder, o usuário ainda
      // precisa sair — os cookies já foram apagados pelo Route Handler.
      queryClient.clear();
      router.replace("/login");
    },
  });
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

/**
 * Troca a própria senha e sai em seguida.
 *
 * O backend revoga **todos** os refresh tokens do usuário, inclusive o desta
 * aba. O access token atual continuaria valendo por uns 15 minutos e então a
 * sessão morreria no meio de alguma coisa; deslogar na hora é o comportamento
 * honesto — e é o que a própria documentação da API recomenda.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: PasswordChange) => {
      await fetchVoid("/api/account/password", {
        method: "PATCH",
        ...jsonBody(input),
      });
      await fetchVoid("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login?reason=password-changed");
    },
  });
}
