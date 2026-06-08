/**
 * Formata milissegundos em texto legível e adaptativo.
 *
 *   5356128000 ms → "6d : 23h : 48min"
 *      2723000 ms → "45min : 23s"
 *        30000 ms → "30s"
 *
 * A ordenação do ranking usa total_time_ms (precisão de ms),
 * então mudar só o texto exibido nunca altera a posição.
 */
function formatMs(ms) {
  if (ms == null) return null;

  let totalSec = Math.floor(Number(ms) / 1000);

  const days = Math.floor(totalSec / 86400);
  totalSec %= 86400;
  const hours = Math.floor(totalSec / 3600);
  totalSec %= 3600;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;

  if (days > 0)  return `${days}d : ${hours}h : ${mins}min`;
  if (hours > 0) return `${hours}h : ${mins}min`;
  if (mins > 0)  return `${mins}min : ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

module.exports = { formatMs };
