uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

uniform float outlineWidth;

attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;

varying vec3 vPosition;

void main(void) {
    vec3 expanded = aVertexPosition + aVertexNormal * outlineWidth;

    gl_Position = uPMatrix * uMVMatrix * vec4(expanded, 1.0);
    vec3 mvVertex = (uMVMatrix * vec4(aVertexPosition, 1.0)).xyz;
    vPosition = mvVertex;
}
