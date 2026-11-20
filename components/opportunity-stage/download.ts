export function downloadText(filename: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Firefox ignores a click on a link that is not in the page, and revoking the address in the same tick can cancel
  // the download before the browser reads it, so the link is attached and the address freed a moment later.
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
