// Toon Shading

#extension GL_OES_standard_derivatives : enable

precision mediump float;

// light coef.
uniform float Ka;
uniform float Kd;
uniform float Ks;
uniform float shininess;

#define LIGHTS 2

// Light position
uniform vec3 lightLoc[LIGHTS];
// Light color
uniform vec3 lightColor[LIGHTS];

uniform vec4 clipPlane[3];

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vColor;

uniform sampler2D uSampler;
uniform int useTexture;
varying vec2 vTexCoord;

void main(void) {

    // clipping
    for (int i = 0; i < 3; i++) {
        if (dot(vec4(vPosition, 1.0), clipPlane[i]) < 0.0) {
            discard;
        }
    }

    vec3 V = -normalize(vPosition);
    vec3 N = normalize(vNormal);

    vec3 ambient = Ka * vColor;

    vec3 diffuse = vec3(0.0);
    // vec3 specular = vec3(0.0);
    vec3 L = vec3(0.0);
    vec3 H = vec3(0.0);
    for (int i = 0; i < LIGHTS; i++) {
        L = normalize(lightLoc[i] - vPosition);
        H = normalize(L + V);
        float diff = max(dot(N, L), 0.0);
        // Toon shading effect
        if (diff > 0.9) {
            diffuse += vec3(1.0, 1.0, 1.0) * Kd * diff * lightColor[i];
        } else if (diff > 0.7) {
            diffuse += vec3(0.8, 0.8, 0.8) * Kd * diff * lightColor[i];
        } else if (diff > 0.2) {
            diffuse += vec3(0.5, 0.5, 0.5) * Kd * diff * lightColor[i];
        }
    }

    vec4 color = vec4(ambient + diffuse, 1.0);
    if (useTexture == 0) {
        gl_FragColor = color;
    } else {
        gl_FragColor = texture2D(uSampler, vTexCoord) * color;
    }
}