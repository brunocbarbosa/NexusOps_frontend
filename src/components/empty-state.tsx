/**
 * O que uma tela mostra quando a API respondeu 403.
 *
 * Não é um erro a ser resolvido tentando de novo: o papel de quem está olhando
 * não alcança aquele recurso, e o backend relê o papel a cada requisição — um
 * 403 pode aparecer numa tela que estava funcionando. Por isso é um estado com
 * texto próprio, e não um alerta vermelho.
 */
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </div>
  );
}
