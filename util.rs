#[no_mangle]
pub unsafe extern "C" fn read_ptr(src: *const u8) -> u8 {
  *src
}
