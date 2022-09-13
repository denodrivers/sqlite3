build/libsqlite3.dylib:
	mkdir -p build
	cd sqlite && mkdir -p build && cd build && ../configure && make
	cp sqlite/build/.libs/libsqlite3.dylib build/libsqlite3.dylib

clean:
	rm -rf build/
