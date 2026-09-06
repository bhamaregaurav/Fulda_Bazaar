# enable required GCP APIs
resource "google_project_service" "required" {
  for_each = toset(var.required_apis)
  project = var.project_id
  service = each.key
  disable_on_destroy = false
}

# create GCP bucket for about-us page to serve out static site 
resource "google_storage_bucket" "static_site" {
  name                        = var.static_bucket_name
  location                    = var.area
  force_destroy               = true
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "error.html"
  }
}

# grant public access to bucket
resource "google_storage_bucket_iam_binding" "public_access" {
  bucket = google_storage_bucket.static_site.name

  role = "roles/storage.objectViewer"

  members = [
    "allUsers"
  ]
}

locals {
  static_files = fileset("../../aboutus", "**/*.*")
}

# upload static files to GCP bucket
resource "google_storage_bucket_object" "static_files" {
  for_each = { for file in local.static_files : file => file }

  name          = each.key
  bucket        = google_storage_bucket.static_site.name
  source        = "../../aboutus/${each.value}"
  content_type  = lookup(
    {
      html = "text/html"
      css  = "text/css"
      js   = "application/javascript"
      png  = "image/png"
      jpg  = "image/jpeg"
      jpeg = "image/jpeg"
      svg  = "image/svg+xml"
    },
    lower(trimspace(reverse(split(".", each.key))[0])),
    "application/octet-stream"
  )
  cache_control = "no-cache, max-age=0"
}


# create GCP bucket for storing images resources used by our application
resource "google_storage_bucket" "content_bucket" {
  name                        = var.content_bucket_name
  location                    = var.area
  force_destroy               = true
  uniform_bucket_level_access = true
}

# grant public access to bucket
resource "google_storage_bucket_iam_binding" "public_access_content" {
  bucket = google_storage_bucket.content_bucket.name

  role = "roles/storage.objectViewer"

  members = [
    "allUsers"
  ]
}


# create VM to run our FULDA BAZAAR application
resource "google_compute_instance" "ubuntu_vm" {
  name         = var.app_name
  machine_type = var.machine_types # 2 vCPU, 4 GB RAM
  zone         = var.zone

  boot_disk {
    initialize_params {
      image  = "ubuntu-os-cloud/ubuntu-2204-lts"
      size   = 100 # 100 GB
      type   = "pd-balanced"
    }
  }

  network_interface {
    network = "default"

    access_config {
      # This assigns an ephemeral external IP
    }
  }

  service_account {
    email  = "fulda-bazaar@gdsd-465815.iam.gserviceaccount.com"
    scopes = ["cloud-platform"]
  }

  metadata = {
    # Add the SSH public key for the desired user
    ssh-keys = "ubuntu:${file("../../credentials/project_vm_key.pub")}"
  }

  tags = ["http-server", "https-server"]

  labels = {
    environment = "dev"
  }

  depends_on = [ google_project_service.required ]
}