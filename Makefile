clean:
	@rm -rf build

build-js:
	@mkdir -p build
	@cp infinity.js ./build/infinity.js
	@./node_modules/.bin/uglifyjs -o ./build/infinity.min.js infinity.js

build: clean build-js

.PHONY: build
