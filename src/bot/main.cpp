#include <emscripten/emscripten.h>

extern "C" {
	#ifdef __EMSCRIPTEN__
	EMSCRIPTEN_KEEPALIVE
	#endif

	bool is_ready() {
		return true;
	}
}