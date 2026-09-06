variable "project_id" {
  type        = string
  sensitive = true
  description = "The GCP project ID"
}

variable "area" {
  type = string
  default = "EU"
  description = "value"
}

variable "region" {
  type        = string
  default     = "europe-west10"
}

variable "zone" {
  type = string
  description = "value"
  default = "europe-west10-a"
}

variable "credentials" { }

variable "static_bucket_name" {
  type        = string
  default = "gdsd-team5-aboutus1"
  description = "Name of the GCS bucket for about us page"
}

variable "content_bucket_name" {
  type        = string
  default = "fulda-bazaar-content"
  description = "Name of the GCS bucket to be used by application for uploading images"
}
variable "required_apis" {
  type = list(string)
  default = [
    "container.googleapis.com",
    "compute.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "servicemanagement.googleapis.com",
    "serviceusage.googleapis.com",
    "file.googleapis.com"
  ]
}

variable "machine_name" {
  type = string
  default = "ubuntu-24-vm"
  description = "Name of the VM"
}

variable "machine_types" {
  type = string
  default = "e2-standard-2"
  description = "Machine type for the VM"
}

variable "app_name" {
  description = "application name"
  type        = string
  default = "fulda-bazaar"
}