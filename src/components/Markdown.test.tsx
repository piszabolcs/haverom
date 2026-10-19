import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from './Markdown';

describe('Markdown', () => {
  it('renders a remote image as a link and never as an <img> that would load it', () => {
    const html = renderToStaticMarkup(
      <Markdown content="![pixel](http://127.0.0.1:9/leak.png?d=secret)" />
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('href="http://127.0.0.1:9/leak.png?d=secret"');
  });
});
