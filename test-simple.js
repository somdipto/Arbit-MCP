#!/usr/bin/env node

/**
 * Simple Test Script for CSAAB
 * Tests basic functionality without TypeScript compilation
 */

console.log('🧪 CSAAB Simple Testing Suite');
console.log('==============================\n');

// Test 1: Check package.json
console.log('1. Testing package.json...');
try {
  const packageJson = require('./package.json');
  console.log('✅ package.json loaded successfully');
  console.log(`   - Name: ${packageJson.name}`);
  console.log(`   - Version: ${packageJson.version}`);
  console.log(`   - Dependencies: ${Object.keys(packageJson.dependencies).length} packages`);
  console.log(`   - Dev Dependencies: ${Object.keys(packageJson.devDependencies).length} packages`);
} catch (error) {
  console.log('❌ package.json loading failed:', error.message);
}

// Test 2: Check TypeScript config
console.log('\n2. Testing TypeScript configuration...');
try {
  const tsConfig = require('./tsconfig.json');
  console.log('✅ tsconfig.json loaded successfully');
  console.log(`   - Target: ${tsConfig.compilerOptions.target}`);
  console.log(`   - Module: ${tsConfig.compilerOptions.module}`);
  console.log(`   - Strict: ${tsConfig.compilerOptions.strict}`);
} catch (error) {
  console.log('❌ tsconfig.json loading failed:', error.message);
}

// Test 3: Check Jest config
console.log('\n3. Testing Jest configuration...');
try {
  const jestConfig = require('./jest.config.js');
  console.log('✅ jest.config.js loaded successfully');
  console.log(`   - Test Environment: ${jestConfig.testEnvironment}`);
  console.log(`   - Coverage Threshold: ${jestConfig.coverageThreshold.global.lines}%`);
} catch (error) {
  console.log('❌ jest.config.js loading failed:', error.message);
}

// Test 4: Check Docker config
console.log('\n4. Testing Docker configuration...');
try {
  const fs = require('fs');
  const dockerfile = fs.readFileSync('./Dockerfile', 'utf8');
  const dockerCompose = fs.readFileSync('./docker-compose.yml', 'utf8');
  
  console.log('✅ Docker files found');
  console.log(`   - Dockerfile: ${dockerfile.split('\n').length} lines`);
  console.log(`   - docker-compose.yml: ${dockerCompose.split('\n').length} lines`);
  
  // Check for key services
  const services = ['postgres', 'redis', 'csab'];
  services.forEach(service => {
    if (dockerCompose.includes(service)) {
      console.log(`   - Service found: ${service}`);
    }
  });
} catch (error) {
  console.log('❌ Docker configuration check failed:', error.message);
}

// Test 5: Check project structure
console.log('\n5. Testing project structure...');
try {
  const fs = require('fs');
  const path = require('path');
  
  const directories = [
    'src',
    'src/config',
    'src/models',
    'src/services',
    'src/controllers',
    'src/middleware',
    'src/utils',
    'src/types',
    'tests'
  ];
  
  let foundDirs = 0;
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      foundDirs++;
      console.log(`   ✅ ${dir}/`);
    } else {
      console.log(`   ❌ ${dir}/ (missing)`);
    }
  });
  
  console.log(`   - Found ${foundDirs}/${directories.length} directories`);
} catch (error) {
  console.log('❌ Project structure check failed:', error.message);
}

// Test 6: Check source files
console.log('\n6. Testing source files...');
try {
  const fs = require('fs');
  const path = require('path');
  
  const sourceFiles = [
    'src/types/index.ts',
    'src/config/index.ts',
    'src/models/User.ts',
    'src/services/MCPService.ts',
    'src/services/PriceMonitoringService.ts',
    'src/utils/logger.ts',
    'src/index.ts'
  ];
  
  let foundFiles = 0;
  sourceFiles.forEach(file => {
    if (fs.existsSync(file)) {
      foundFiles++;
      const stats = fs.statSync(file);
      console.log(`   ✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`   ❌ ${file} (missing)`);
    }
  });
  
  console.log(`   - Found ${foundFiles}/${sourceFiles.length} source files`);
} catch (error) {
  console.log('❌ Source files check failed:', error.message);
}

// Test 7: Check environment files
console.log('\n7. Testing environment configuration...');
try {
  const fs = require('fs');
  
  const envFiles = ['env.example', 'env.test'];
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      console.log(`   ✅ ${file} (${lines.length} config variables)`);
    } else {
      console.log(`   ❌ ${file} (missing)`);
    }
  });
} catch (error) {
  console.log('❌ Environment configuration check failed:', error.message);
}

// Test 8: Check documentation
console.log('\n8. Testing documentation...');
try {
  const fs = require('fs');
  
  const docs = ['README.md', 'TESTING_GUIDE.md', 'IMPLEMENTATION_SUMMARY.md'];
  docs.forEach(doc => {
    if (fs.existsSync(doc)) {
      const stats = fs.statSync(doc);
      console.log(`   ✅ ${doc} (${stats.size} bytes)`);
    } else {
      console.log(`   ❌ ${doc} (missing)`);
    }
  });
} catch (error) {
  console.log('❌ Documentation check failed:', error.message);
}

console.log('\n🎉 Simple testing completed!');
console.log('\n📋 Next Steps:');
console.log('1. Fix TypeScript compilation errors (see errors above)');
console.log('2. Set up PostgreSQL and Redis databases');
console.log('3. Configure environment variables');
console.log('4. Run: npm run dev (for development server)');
console.log('5. Run: docker-compose up (for full stack testing)');
console.log('\n📚 For detailed testing instructions, see: TESTING_GUIDE.md');
