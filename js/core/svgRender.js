export function renderDocToSvgString(doc){
  const { wMm, hMm } = doc.page;

  const defsStr = doc.defs.length
    ? `<defs>\n${doc.defs.join("\n")}\n</defs>\n`
    : "";

  // Nota: vector para impresión: sin estilos CSS complejos
  // Preservamos mm directos y viewBox en mm.
  return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="${wMm}mm" height="${hMm}mm"
     viewBox="0 0 ${wMm} ${hMm}">
  <metadata>generator=${doc.meta.generator}; version=${doc.meta.version}; seed=${doc.seed}</metadata>
  ${defsStr}
  ${doc.body.join("\n")}
</svg>`.trim();
}
