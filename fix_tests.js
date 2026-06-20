const fs = require('fs');

const files = [
    'tests/codegen.test.ts',
    'tests/errors.test.ts',
    'tests/explain.test.ts',
    'tests/analyzer.test.ts',
    'tests/parser.test.ts'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Replace `output: { type: 'OUTPUT', value: 'xyz' ... }` 
    // with `outputs: [{ type: 'OUTPUT_BLOCK', file: 'xyz', overrides: {} ... }]`
    
    content = content.replace(/output\s*:\s*{\s*type\s*:\s*['"]OUTPUT['"],\s*value\s*:\s*([^,]+)([^}]*)}/g, 
        'outputs: [{ type: \'OUTPUT_BLOCK\', file: $1, overrides: {}$2}]');

    content = content.replace(/output\s*:\s*undefined\s*as\s*any/g, 'outputs: []');

    content = content.replace(/ast\.output\b/g, 'ast.outputs[0]');
    content = content.replace(/ast\.outputs\[0\]\?\.value/g, 'ast.outputs[0]?.file');

    fs.writeFileSync(file, content);
}
console.log("Done");
