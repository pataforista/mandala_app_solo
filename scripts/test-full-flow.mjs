// Prueba de flujo completo: generación → composición → métricas
import { createDoc } from '../js/core/svgDoc.js';
import { renderDocToSvgString } from '../js/core/svgRender.js';
import { generateMandalaClassic } from '../js/generators/mandalaClassic.js';
import { generateMandalaRadial } from '../js/generators/mandalaRadial.js';
import { measureSvg, commercialScore } from '../js/core/commercialMetrics.js';
import { planBook, bestSellerProfile } from '../js/core/bookPlan.js';

console.log('=== Prueba de Flujo Completo ===\n');

// 1. Generar mandala clásico
console.log('1. Generando mandala clásico...');
const doc1 = createDoc({ preset: 'KDP_8_5x11', seed: 42, marginMm: 10 });
generateMandalaClassic(doc1, {
  seed: 42,
  petals: 16,
  strokeWidthMm: 0.8,
  complexity: 130,
  styleMode: 'floral',
  composition: 'centro',
  structure: 'corona'
});
const svg1 = renderDocToSvgString(doc1);
console.log(`   ✓ SVG generado: ${svg1.length} bytes`);

// 2. Medir métricas
console.log('2. Midiendo métricas...');
const metrics1 = measureSvg(svg1, { center: { x: 105, y: 148.5 } });
console.log(`   ✓ Regiones: ${metrics1.regiones}`);
console.log(`   ✓ Celdas pequeñas: ${metrics1.pequenas.toFixed(1)}%`);
console.log(`   ✓ Trazos finos: ${metrics1.finas.toFixed(1)}%`);
if (metrics1.cobertura) console.log(`   ✓ Cobertura: ${metrics1.cobertura.toFixed(1)}%`);
if (metrics1.balanceRadial) console.log(`   ✓ Balance radial: ${metrics1.balanceRadial.toFixed(1)}%`);
if (metrics1.riquezaDetalle) console.log(`   ✓ Riqueza detalle: ${metrics1.riquezaDetalle.toFixed(2)}`);

// 3. Calcular score comercial
console.log('3. Calculando score comercial...');
const { score, issues } = commercialScore(metrics1, { strokeWidthMm: 0.8, minCellAreaMm2: 5 });
console.log(`   ✓ Score: ${score}/100`);
if (issues.length > 0) console.log(`   ⚠ Issues: ${issues.join(', ')}`);

// 4. Generar mandala radial
console.log('4. Generando mandala radial...');
const doc2 = createDoc({ preset: 'KDP_8_5x11', seed: 99, marginMm: 10 });
generateMandalaRadial(doc2, {
  seed: 99,
  petals: 12,
  strokeWidthMm: 0.7,
  complexity: 150
});
const svg2 = renderDocToSvgString(doc2);
console.log(`   ✓ SVG generado: ${svg2.length} bytes`);

// 5. Planificar libro completo
console.log('5. Planificando libro de 20 páginas...');
const plan = planBook({
  count: 20,
  seed: 123,
  ...bestSellerProfile('KDP_8_5x11')
});
console.log(`   ✓ Plan generado: ${plan.length} páginas`);
console.log(`   ✓ Estructuras: ${[...new Set(plan.map(p => p.structure))].join(', ')}`);
console.log(`   ✓ Estilos: ${[...new Set(plan.map(p => p.styleMode))].join(', ')}`);

// 6. Verificar que no hay NaN/undefined en SVGs
console.log('6. Verificando integridad de SVGs...');
const hasNaN = svg1.includes('NaN') || svg1.includes('undefined') || svg2.includes('NaN') || svg2.includes('undefined');
if (hasNaN) {
  console.log('   ✗ ERROR: SVGs contienen NaN o undefined');
  process.exit(1);
} else {
  console.log('   ✓ SVGs limpios (sin NaN/undefined)');
}

console.log('\n=== Todas las verificaciones pasaron ===');
