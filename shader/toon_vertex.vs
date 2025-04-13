// Toon Shading

attribute vec3 aVertexPosition;
attribute vec3 aFrontColor;
attribute vec3 aVertexNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vColor;

// Texture
attribute vec2 aTextureCoord;
varying vec2 vTexCoord;

void main(void) {

    // Transform VertexPosition and VertexNormal to world coordinate system
    vec3 mvVertex = (uMVMatrix * vec4(aVertexPosition, 1.0)).xyz;
    vec3 mvNormal = mat3(uMVMatrix) * aVertexNormal;
    vNormal = mvNormal;
    vPosition = mvVertex;
    vColor = aFrontColor;
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    vTexCoord = aTextureCoord;
}