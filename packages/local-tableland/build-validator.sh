cd ../go-tableland

BIN_BUILD_FLAGS="GOOS=darwin" make build-api-debug
mv api ../local-tableland/validator/bin/darwin

BIN_BUILD_FLAGS="GOOS=linux" make build-api-debug
mv api ../local-tableland/validator/bin/linux

BIN_BUILD_FLAGS="GOOS=windows" make build-api-debug
mv api ../local-tableland/validator/bin/windows

cd ../local-tableland
