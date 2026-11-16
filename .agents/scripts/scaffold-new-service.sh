#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SCAFFOLD-NEW-SERVICE: Clean Architecture Microservice Generator
# ==============================================================================
# Generates a production-ready, fully compliant Clean Architecture service
# pre-wired with .agents/ rules, hooks, and tests.
#
# Usage:
#   ./.agents/scripts/scaffold-new-service.sh my-billing-service
#   make new-service NAME=my-billing-service
# ==============================================================================

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVICE_NAME="${1:-${NAME:-}}"

if [[ -z "$SERVICE_NAME" ]]; then
    echo -e "${RED}[ERROR] Service name is required!${NC}"
    echo "Usage: $0 <service-name>"
    echo "   or: make new-service NAME=<service-name>"
    exit 1
fi

TARGET_DIR="./services/${SERVICE_NAME}"

if [[ -d "$TARGET_DIR" ]]; then
    echo -e "${RED}[ERROR] Directory '${TARGET_DIR}' already exists! Choose another name.${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo -e "${YELLOW}====================================================================${NC}"
echo -e "${YELLOW}   SCAFFOLDING NEW ENTERPRISE SERVICE: ${SERVICE_NAME}              ${NC}"
echo -e "${YELLOW}====================================================================${NC}\n"

# 1. Create Clean Architecture Directory Layout
mkdir -p "${TARGET_DIR}/src/domain/entities"
mkdir -p "${TARGET_DIR}/src/domain/value-objects"
mkdir -p "${TARGET_DIR}/src/application/use-cases"
mkdir -p "${TARGET_DIR}/src/application/ports"
mkdir -p "${TARGET_DIR}/src/infrastructure/repositories"
mkdir -p "${TARGET_DIR}/src/infrastructure/database"
mkdir -p "${TARGET_DIR}/src/presentation/controllers"
mkdir -p "${TARGET_DIR}/tests/unit"
mkdir -p "${TARGET_DIR}/tests/integration"

# 2. Generate package.json
cat > "${TARGET_DIR}/package.json" << EOF
{
  "name": "${SERVICE_NAME}",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
EOF

# 3. Generate Strict tsconfig.json
cat > "${TARGET_DIR}/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# 4. Generate Sample Domain Entity
cat > "${TARGET_DIR}/src/domain/entities/sample.entity.ts" << 'EOF'
export interface SampleProps {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

export class SampleEntity {
  private constructor(private readonly props: SampleProps) {}

  public static create(name: string, id: string = `018dc320-${Date.now()}`): SampleEntity {
    if (!name || name.trim().length === 0) {
      throw new Error('SampleEntity name cannot be empty');
    }
    return new SampleEntity({
      id,
      name: name.trim(),
      createdAt: new Date(),
    });
  }

  public get id(): string { return this.props.id; }
  public get name(): string { return this.props.name; }
  public get createdAt(): Date { return this.props.createdAt; }
}
EOF

# 5. Generate AAA Unit Test
cat > "${TARGET_DIR}/tests/unit/sample.entity.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest';
import { SampleEntity } from '../../src/domain/entities/sample.entity.js';

describe('SampleEntity', () => {
  it('should create valid entity when name is non-empty', () => {
    // 1. ARRANGE
    const name = 'Production Feature';

    // 2. ACT
    const entity = SampleEntity.create(name);

    // 3. ASSERT
    expect(entity.name).toBe(name);
    expect(entity.id).toBeDefined();
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  it('should throw error when name is empty', () => {
    // 1. ARRANGE
    const invalidName = '   ';

    // 2. ACT & 3. ASSERT
    expect(() => SampleEntity.create(invalidName)).toThrow('SampleEntity name cannot be empty');
  });
});
EOF

# 6. Synchronize .agents/ standards into the new service
echo -e "${YELLOW}Syncing .agents/ standards into ${TARGET_DIR}...${NC}"
"${ROOT_DIR}/.agents/scripts/sync-to-project.sh" "${TARGET_DIR}"

echo -e "\n${GREEN}✅ Enterprise service '${SERVICE_NAME}' scaffolded successfully at ${TARGET_DIR}!${NC}"
echo -e "Next steps:"
echo -e "  cd ${TARGET_DIR}"
echo -e "  make verify"
