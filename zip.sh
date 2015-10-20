#!/bin/bash
#package for chrome web store
cd ..
rm -f HNES.zip
zip -r HNES.zip HNES -x \*.git\* *screenshots* *notes* *zip.sh*
