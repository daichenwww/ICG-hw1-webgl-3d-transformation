precision mediump float;
uniform vec4 clipPlane[3];
varying vec3 vPosition;
void main(void) {
    // clipping
    for (int i = 0; i < 3; i++) {
        if (dot(vec4(vPosition, 1.0), clipPlane[i]) < 0.0) {
            discard;
        }
    }
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); 
}
