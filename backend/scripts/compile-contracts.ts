/**
 * Compile Solidity contracts and output bytecode
 */

import solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

const contractsDir = path.join(import.meta.dir, '..', 'contracts');
const outputDir = path.join(import.meta.dir, '..', 'compiled');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Read the contract source
const contractPath = path.join(contractsDir, 'SuperMoltRewardToken.sol');
const contractSource = fs.readFileSync(contractPath, 'utf-8');

// Find all OpenZeppelin imports and read them
function findImports(importPath: string): { contents?: string; error?: string } {
    try {
        // Handle OpenZeppelin imports
        if (importPath.startsWith('@openzeppelin/')) {
            const ozPath = path.join(
                import.meta.dir,
                '..',
                'node_modules',
                importPath
            );
            if (fs.existsSync(ozPath)) {
                return { contents: fs.readFileSync(ozPath, 'utf-8') };
            }
        }
        return { error: 'File not found' };
    } catch (error) {
        return { error: String(error) };
    }
}

// Prepare the input for the compiler
const input = {
    language: 'Solidity',
    sources: {
        'SuperMoltRewardToken.sol': {
            content: contractSource,
        },
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
            },
        },
    },
};

console.log('Compiling SuperMoltRewardToken.sol...');

// Compile the contract
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors
if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
        console.error('Compilation errors:');
        errors.forEach((error: any) => {
            console.error(error.formattedMessage);
        });
        process.exit(1);
    }

    // Show warnings
    const warnings = output.errors.filter((e: any) => e.severity === 'warning');
    if (warnings.length > 0) {
        console.warn('Warnings:');
        warnings.forEach((warning: any) => {
            console.warn(warning.formattedMessage);
        });
    }
}

// Extract the compiled contract
const contract = output.contracts['SuperMoltRewardToken.sol']['SuperMoltRewardToken'];

if (!contract) {
    console.error('Contract not found in compilation output');
    process.exit(1);
}

// Save the ABI and bytecode
const compiledOutput = {
    contractName: 'SuperMoltRewardToken',
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
    compiler: {
        version: '0.8.24',
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
};

const outputPath = path.join(outputDir, 'SuperMoltRewardToken.json');
fs.writeFileSync(outputPath, JSON.stringify(compiledOutput, null, 2));

console.log('✓ Compilation successful!');
console.log(`✓ Output saved to: ${outputPath}`);
console.log(`✓ Bytecode size: ${contract.evm.bytecode.object.length / 2} bytes`);
console.log(`✓ ABI functions: ${contract.abi.filter((item: any) => item.type === 'function').length}`);
