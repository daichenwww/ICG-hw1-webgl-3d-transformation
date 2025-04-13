// Gouraud Shading: Lighting is calculated per vertex using vertex normals; colors are interpolated across the triangle’s surface.

#extension GL_OES_standard_derivatives : enable

precision mediump float;

uniform vec4 clipPlane[3];

varying vec4 fragcolor;
varying vec3 vPosition;

varying vec2 vTexCoord;
uniform sampler2D uSampler;
uniform int useTexture; 

void main(void) {
    // clipping
    for (int i = 0; i < 3; i++) {
        if (dot(vec4(vPosition, 1.0), clipPlane[i]) < 0.0) {
            discard;
        }
    }
    if (useTexture == 0) {
        gl_FragColor = fragcolor;
    } else {
        gl_FragColor = texture2D(uSampler, vTexCoord) * fragcolor;
    }
}