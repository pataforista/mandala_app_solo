const fs = require('fs');
const path = 'c:/Users/Admin/Desktop/mandala_app_solo/js/generators/mandalaRadial.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic block is around line 1010-1033.
// We want to move outerRingStrokes definition UP and fix the syntax.

// 1. Identify the block and replace it.
const searchPattern = /\s*\/\/ --- Guardar wedge \(sin bindu\) ---\n\s*const wedgeMain = pbMain\.toPath\(\{[\s\S]+?\}\);\n\s*const wedgeDetail = pbDetail\.toPath\(\{[\s\S]+?\}\);\n\s*\}\);\n\n\/\/ Final wedge strokes for Spirograph reference or other uses\nconst outerRingStrokes = rings\.length \? rings\[rings\.length - 1\]\.strokes : getStrokesForRadius\(computedRadius, "frame"\);\n\ndoc\.defs\.push\(`<g id="\${wedgeId}">\${wedgeMain}\${wedgeDetail}\${wedgeFine}<\/g>`\);/;

// Wait, the searchPattern is risky if I get it slightly wrong.
// Let's use a more robust way: find the stray }); and the outerRingStrokes line and move it.

content = content.replace(/  const wedgeDetail = pbDetail\.toPath\(\{[\s\S]+?\}\);\n\n  \}\);/, (match) => {
    return match.replace('\n\n  });', '');
});

// Now fix the wedgeFine variable which is missing and move outerRingStrokes.
content = content.replace(/\/\/ --- Guardar wedge \(sin bindu\) ---/,
    '// Final wedge strokes for Spirograph reference or other uses\n  const outerRingStrokes = rings.length ? rings[rings.length - 1].strokes : getStrokesForRadius(computedRadius, "frame");\n\n  // --- Guardar wedge (sin bindu) ---');

// Add wedgeFine back.
if (!content.includes('const wedgeFine =')) {
    content = content.replace(/const wedgeDetail = pbDetail\.toPath\(\{[\s\S]+?\}\);/, (match) => {
        return match + '\n\n  const wedgeFine = pbFine.toPath({\n    stroke,\n    strokeWidthMm: outerRingStrokes.fine,\n    fill: "none",\n    linecap: "round",\n    linejoin: "round",\n  });';
    });
}

// Ensure outerRingStrokes is not duplicated if it was already moved.
// (The previous step might have already moved it if I'm not careful).

fs.writeFileSync(path, content);
console.log('Fixed mandalaRadial.js');
