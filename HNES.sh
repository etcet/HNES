#!/bin/bash

rm -rf zip
mkdir -p zip/HNES/images
cp HNES/background.js zip/HNES
cp HNES/images/icon*.png zip/HNES/images
cp -R HNES/js zip/HNES
cp HNES/LICENSE zip/HNES
cp HNES/manifest.json zip/HNES
cp HNES/README.md zip/HNES
cp HNES/style.css zip/HNES
cd zip/
chromium --pack-extension=HNES --pack-extension-key=../HNES.pem
zip -r HNES.zip HNES
