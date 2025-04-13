// Phong Shading: Lighting is calculated per pixel (in fragment); interpolated normals are used for accurate lighting results.

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
    vec3 specular = vec3(0.0);
    vec3 L = vec3(0.0);
    vec3 H = vec3(0.0);
    for (int i = 0; i < LIGHTS; i++) {
        L = normalize(lightLoc[i] - vPosition);
        H = normalize(L + V);
        float diff = max(dot(N, L), 0.0);
        float spec = pow(max(dot(N, H), 0.0), shininess);
        diffuse += Kd * diff * lightColor[i];
        specular += Ks * spec * lightColor[i];
    }


    vec4 color = vec4(ambient + diffuse + specular, 1.0);
    if (useTexture == 0) {
        gl_FragColor = color;
    } else {
        gl_FragColor = texture2D(uSampler, vTexCoord) * color;
    }
}