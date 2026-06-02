const { lexer } = require('../src/lexer');

// Test suite for the lexer
function assertEquals(actual: any, expected: any, message: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`❌ FAILED: ${message}`);
        console.error(`  Expected: ${JSON.stringify(expected)}`);
        console.error(`  Actual: ${JSON.stringify(actual)}`);
        return false;
    }
    console.log(`✅ PASSED: ${message}`);
    return true;
}

function runTests() {
    let passed = 0;
    let failed = 0;

    // Test 1: Basic keywords
    const test1 = lexer('resize 1920x1080');
    const expected1 = [
        { type: 'KEYWORD', value: 'resize', line: 1 },
        { type: 'RESOLUTION', value: '1920x1080', line: 1 }
    ];
    if (assertEquals(test1, expected1, 'Should recognize keywords and resolutions')) passed++; else failed++;

    // Test 2: Identifiers with hyphens
    const test2 = lexer('bottom-right');
    const expected2 = [
        { type: 'IDENTIFIER', value: 'bottom-right', line: 1 }
    ];
    if (assertEquals(test2, expected2, 'Should recognize identifiers with hyphens')) passed++; else failed++;

    // Test 3: Numbers
    const test3 = lexer('fps 30');
    const expected3 = [
        { type: 'KEYWORD', value: 'fps', line: 1 },
        { type: 'NUMBER', value: '30', line: 1 }
    ];
    if (assertEquals(test3, expected3, 'Should recognize keywords and numbers')) passed++; else failed++;

    // Test 4: Strings
    const test4 = lexer('output "video.mp4"');
    const expected4 = [
        { type: 'KEYWORD', value: 'output', line: 1 },
        { type: 'STRING', value: '"video.mp4"', line: 1 }
    ];
    if (assertEquals(test4, expected4, 'Should recognize strings')) passed++; else failed++;

    // Test 5: Multiple lines
    const test5 = lexer('resize 1920x1080\nfps 30');
    const expected5 = [
        { type: 'KEYWORD', value: 'resize', line: 1 },
        { type: 'RESOLUTION', value: '1920x1080', line: 1 },
        { type: 'KEYWORD', value: 'fps', line: 2 },
        { type: 'NUMBER', value: '30', line: 2 }
    ];
    if (assertEquals(test5, expected5, 'Should handle multiple lines')) passed++; else failed++;

    // Test 6: Resolutions
    const test6 = lexer('1280x720');
    const expected6 = [
        { type: 'RESOLUTION', value: '1280x720', line: 1 }
    ];
    if (assertEquals(test6, expected6, 'Should recognize resolutions')) passed++; else failed++;

    // Test 7: All keywords
    const test7 = lexer('resize input fps output encode bitrate audio watermark thumbnail');
    if (test7.length === 9 && test7.every((t: any) => t.type === 'KEYWORD')) {
        console.log(`✅ PASSED: Should recognize all keywords`);
        passed++;
    } else {
        console.error(`❌ FAILED: Should recognize all keywords`);
        failed++;
    }

    // Test 8: Hyphenated identifiers
    const test8 = lexer('top-left middle-center bottom-right');
    const expected8 = [
        { type: 'IDENTIFIER', value: 'top-left', line: 1 },
        { type: 'IDENTIFIER', value: 'middle-center', line: 1 },
        { type: 'IDENTIFIER', value: 'bottom-right', line: 1 }
    ];
    if (assertEquals(test8, expected8, 'Should recognize multiple hyphenated identifiers')) passed++; else failed++;

    // Test 9: Empty lines should be skipped
    const test9 = lexer('resize 1920x1080\n\nfps 30');
    const expected9 = [
        { type: 'KEYWORD', value: 'resize', line: 1 },
        { type: 'RESOLUTION', value: '1920x1080', line: 1 },
        { type: 'KEYWORD', value: 'fps', line: 3 },
        { type: 'NUMBER', value: '30', line: 3 }
    ];
    if (assertEquals(test9, expected9, 'Should skip empty lines')) passed++; else failed++;

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Tests: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
    console.log(`${'='.repeat(50)}\n`);

    return failed === 0;
}

runTests();
