/* Dateien an den Nutzer geben: auf dem iPhone über das Teilen-Menü („In Dateien sichern“), sonst als Download. */

/** Teilt eine Datei (iPhone: "In Dateien sichern") oder lädt sie herunter. */
export async function deliverFile(name: string, content: string, mime: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Teilen fehlgeschlagen → normaler Download als Rückfall
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
