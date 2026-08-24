/**
 * Aplica o tema antes da primeira pintura.
 *
 * Sem este script síncrono, a página aparece clara por um quadro e escurece
 * depois da hidratação — o "flash" que denuncia tema decidido no cliente.
 * Roda no `<head>`, antes de qualquer CSS ser desenhado.
 */
const APPLY_THEME = `(function(){try{var stored=localStorage.getItem('nexusops-theme');var dark=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: APPLY_THEME }} />;
}
