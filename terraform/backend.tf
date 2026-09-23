terraform {
  backend "s3" {
    bucket       = "kyle-scrabble-tfstate"
    key          = "scrabble-webapp/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}