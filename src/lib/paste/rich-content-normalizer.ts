function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

export function normaliseClipboardHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof DOMParser === 'undefined') return rawHtml;

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  doc.querySelectorAll('script, style, meta, link').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (
        name === 'style' ||
        name === 'class' ||
        name === 'id' ||
        name === 'lang' ||
        name.startsWith('on') ||
        name.startsWith('data-')
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  doc.querySelectorAll('span, font').forEach((el) => {
    if (el.attributes.length === 0) {
      unwrapElement(el);
    }
  });

  doc.querySelectorAll('div').forEach((el) => {
    if (el.attributes.length === 0 && el.children.length === 1 && el.textContent?.trim()) {
      const onlyChild = el.children[0];
      if (onlyChild.tagName.toLowerCase() === 'p') {
        unwrapElement(el);
      }
    }
  });

  return doc.body.innerHTML;
}

