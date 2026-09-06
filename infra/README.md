terraform init -backend-config=backend.tfvars
terraform apply -var-file=input.tfvars
terraform destroy -target=google_storage_bucket_object.static_files -var-file=input.tfvars
