// Flat Shading: Lighting is calculated once per face using the face normal; the entire triangle is rendered with a uniform color.

#extension GL_OES_standard_derivatives : enable

attribute vec3 aVertexPosition;
attribute vec3 aFrontColor;
attribute vec3 aVertexNormal;   
attribute vec3 aFaceNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

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

varying vec4 fragcolor;
varying vec3 vPosition;

// Texture
attribute vec2 aTextureCoord;
varying vec2 vTexCoord;

void main(void) {

    // Transform VertexPosition to world coordinate system
    vec3 mvVertex = (uMVMatrix * vec4(aVertexPosition, 1.0)).xyz;
    vec3 mvNormal = mat3(uMVMatrix) * aVertexNormal;
    vPosition = mvVertex;
   // Transform FaceNormal to world coordinate system
    vec3 mvFaceNormal = mat3(uMVMatrix) * aFaceNormal;

    vec3 V = -normalize(mvVertex);
    vec3 N = normalize(mvFaceNormal);

    vec3 ambient = Ka * aFrontColor;
    vec3 diffuse = vec3(0.0);
    vec3 specular = vec3(0.0);
    vec3 L = vec3(0.0);
    vec3 H = vec3(0.0);
    for (int i = 0; i < LIGHTS; i++) {
        L = normalize(lightLoc[i] - mvVertex);
        H = normalize(L + V);
        vec3 lightColor = lightColor[i];
        diffuse += Kd * lightColor * max(dot(N, L), 0.0);
        specular += Ks * lightColor * pow(max(dot(N, H), 0.0), shininess);
    }
            

    fragcolor = vec4(ambient + diffuse + specular, 1.0);
    // fragcolor = vec4(normalize(mvFaceNormal) * 0.5 + 0.5, 1.0);


    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    vTexCoord = aTextureCoord;
}