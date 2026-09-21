output "public_dns_name" {
  description = ""
  value       = aws_lb.scrabble_alb.dns_name
}