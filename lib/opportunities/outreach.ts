/**
 * A reply to the person who described the problem, for the builder to post by hand under that person's own post.
 * Written as a question, not an advert: it quotes them, says what was built and asks whether it helps.
 * Seedup never posts it; posting stays with the person.
 */
export function builtReply(quote: string, productUrl: string, note = '') {
  const said = quote.length > 140 ? `${quote.slice(0, 139).trimEnd()}…` : quote;
  return [
    `Hi, you wrote "${said}". I ran into the same thing and built something to try to fix it${note ? `: ${note.trim().replace(/\.$/, '')}` : ''}.`,
    `It's here if you want to look: ${productUrl}`,
    'Does it actually solve it for you, or what is still missing? Honest feedback would help a lot.',
  ].join('\n\n');
}
