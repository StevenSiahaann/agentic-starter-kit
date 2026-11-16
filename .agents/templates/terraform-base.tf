# ==============================================================================
# Production Terraform Backend with State Locking & Encryption
# Implements: Encrypted S3 Remote State, DynamoDB State Locking, Zero ClickOps
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ENCRYPTED REMOTE STATE BACKEND WITH ATOMIC DYNAMODB LOCKING
  backend "s3" {
    bucket         = "my-company-terraform-states-prod"
    key            = "services/core-backend/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-prod"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = "CoreInfrastructure"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "ap-southeast-1"
}

variable "environment" {
  type    = string
  default = "production"
}
