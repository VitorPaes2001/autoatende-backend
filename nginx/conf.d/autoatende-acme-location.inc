# __AUTOATENDE_TLS_SAN_WEBROOT_STAGING_PREFLIGHT_V20_C1_TLS_B1_R4__
location ^~ /.well-known/acme-challenge/ {
    root /etc/nginx/conf.d/autoatende-acme-webroot;
    default_type text/plain;
    try_files $uri =404;
    add_header Cache-Control "no-store" always;
    add_header X-AutoAtende-ACME "v20-c1-tls-b1-r4" always;
}
