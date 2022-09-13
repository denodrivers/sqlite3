ifeq ($(OS),Darwin)
	EXT = .dylib
else
	EXT = .so
endif

build/libsqlite3.dylib:
	mkdir -p build
	cd sqlite && mkdir -p build && cd build && ../configure && make
	cp sqlite/build/.libs/libsqlite3$(EXT) build/libsqlite3$(EXT)

clean:
	rm -rf build/
