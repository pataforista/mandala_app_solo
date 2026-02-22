const fs = require('fs');
const path = 'c:/Users/Admin/Desktop/mandala_app_solo/js/generators/mandalaRadial.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic block is around line 1038.
// 1038: });
// 1039: 
// 1040: // Final wedge strokes for Spirograph reference or other uses
// 1041: const outerRingStrokes = rings.length ? rings[rings.length - 1].strokes : getStrokesForRadius(computedRadius, "frame");

// We want to remove the stray }); and the duplicate block.

const target = /  \}\);\n\n\/\/ Final wedge strokes for Spirograph reference or other uses\nconst outerRingStrokes = rings\.length \? rings\[rings\.length - 1\]\.strokes : getStrokesForRadius\(computedRadius, "frame"\);\n\n/;

if (content.match(target)) {
    content = content.replace(target, '\n');
    console.log('Removed duplicate block and stray brace.');
} else {
    // If exact match fails, try a slightly more flexible regex
    const flexibleTarget = /\s*\}\);\s*\n\s*\/\/ Final wedge strokes for Spirograph reference or other uses\s*\n\s*const outerRingStrokes = rings\.length \? rings\[rings\.length - 1\]\.strokes : getStrokesForRadius\(computedRadius, "frame"\);\s*\n\s*/;
    if (content.match(flexibleTarget)) {
        content = content.replace(flexibleTarget, '\n\n  ');
        console.log('Removed duplicate block and stray brace (flexible match).');
    } else {
        console.log('Target not found.');
    }
}

fs.writeFileSync(path, content);
