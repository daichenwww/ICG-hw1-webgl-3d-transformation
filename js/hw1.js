// common variables
var gl;
var shaderProgram;

// camera

var camera = {
    eye: vec3.create([0, 0, 10]),
    at: vec3.create([0, 0, 0]),
    up: vec3.create([0, 1, 0]),
    fov: 45,
}

var mvMatrix = mat4.create();
var pMatrix = mat4.create();

var lastTime = 0;

const NUM_LIGHTS = 2; // change this to add more lights (remember to change the shader as well)
const NUM_OBJECTS = 3;
var offsets = [[-25, 0, 0], [0, 0, 0], [20, -8, 0]];
var init_rotation = [[0, 0, 0], [0, 0, 0], [-90, 0, 0]];
const objects_list = ['Teapot.json', 'Mig27.json', 'Csie.json'];
var objects = [];

const shader_list = ['flat', 'gouraud', 'phong', 'toon', 'toon_outline'];
var shading_mode = 0;
var flatShader, gouraudShader, phongShader, toonShader, outlineShader;
var shader_program_list = [flatShader, gouraudShader, phongShader, toonShader, outlineShader];

var lightLoc, lightColor;

const texture_list = ['Wood.jpg', 'InkPaint.jpg', 'Grunge.jpg'];
var textures = [null, null, null];

const clipNormals = [
    [1, 0, 0], // x axis
    [0, 1, 0], // y axis
    [0, 0, 1]  // z axis
];


//*************************************************
// Initialization functions
//*************************************************

function initGL(canvas) {
    try {
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    }
    catch (e) {
    }

    if (!gl) {
        alert("Could not initialise WebGL");
    }
}
// get shader from external file
function getShader(gl, type, url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to load shader: " + url);
            }
            return response.text();
        })
        .then(shaderSource => {
            let shader;
            if (type === "fragment") {
                shader = gl.createShader(gl.FRAGMENT_SHADER);
            } else if (type === "vertex") {
                shader = gl.createShader(gl.VERTEX_SHADER);
            } else {
                return null;
            }

            gl.shaderSource(shader, shaderSource);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                alert(gl.getShaderInfoLog(shader));
                return null;
            }

            return shader;
        })
        .catch(err => {
            console.error(err);
            return null;
        });
}

// link shaders and create program
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Could not link program:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// load shader program
function loadShaderProgram(gl, vsUrl, fsUrl) {
    const vsPromise = getShader(gl, "vertex", vsUrl);
    const fsPromise = getShader(gl, "fragment", fsUrl);

    return Promise.all([vsPromise, fsPromise])
        .then(([vertexShader, fragmentShader]) => {
            if (!vertexShader || !fragmentShader) {
                console.error("Failed to load/compile one of the shaders:", vsUrl, fsUrl);
                return null;
            }
            const program = createProgram(gl, vertexShader, fragmentShader);
            if (!program) {
                console.error("Failed to link program:", vsUrl, fsUrl);
                return null;
            }

            gl.useProgram(program);

            program.vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");
            gl.enableVertexAttribArray(program.vertexPositionAttribute);
            program.vertexFrontColorAttribute = gl.getAttribLocation(program, "aFrontColor");
            if (program.vertexFrontColorAttribute != -1) {
                gl.enableVertexAttribArray(program.vertexFrontColorAttribute);
            }

            program.vertexNormalAttribute = gl.getAttribLocation(program, "aVertexNormal");
            if (program.vertexNormalAttribute != -1) {
                gl.enableVertexAttribArray(program.vertexNormalAttribute);
            }

            program.faceNormalAttribute = gl.getAttribLocation(program, "aFaceNormal");
            if (program.faceNormalAttribute != -1) {
                gl.enableVertexAttribArray(program.faceNormalAttribute);
            }

            program.vertexTextureCoordAttribute = gl.getAttribLocation(program, "aTextureCoord");
            if (program.vertexTextureCoordAttribute != -1) {
                gl.enableVertexAttribArray(program.vertexTextureCoordAttribute);
            }
            program.textureUniform = gl.getUniformLocation(program, "uSampler");
            program.useTexture = gl.getUniformLocation(program, "useTexture");

            program.ka = gl.getUniformLocation(program, "Ka");
            program.kd = gl.getUniformLocation(program, "Kd");
            program.ks = gl.getUniformLocation(program, "Ks");
            program.shininess = gl.getUniformLocation(program, "shininess");

            program.clipPlane = gl.getUniformLocation(program, "clipPlane");

            program.lightLoc = gl.getUniformLocation(program, "lightLoc");
            program.lightColor = gl.getUniformLocation(program, "lightColor");

            program.pMatrixUniform = gl.getUniformLocation(program, "uPMatrix");
            program.mvMatrixUniform = gl.getUniformLocation(program, "uMVMatrix");

            return program;
        });
}

function createPromise(shader_list) {
    let promises = [];
    for (let i = 0; i < shader_list.length; i++) {
        promises.push(loadShaderProgram(gl, 'shader/' + shader_list[i] + '_vertex.vs', 'shader/' + shader_list[i] + '_fragment.fs'));
    }
    return promises;
}

// load all shaders
function initShaders(shader_list) {
    let promises = createPromise(shader_list);
    return Promise.all(promises).then((programs) => {
        for (let i = 0; i < programs.length; i++) {
            shader_program_list[i] = programs[i];
            if (programs[i] == null) {
                alert('Failed to load shader program: ' + shader_list[i]);
            }
        }
    });
}

function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

function LoadObject(idx, data) {
    const obj = objects[idx];

    var [scaleFactor, localCenter] = computeScaleAndCenter(data.vertexPositions);
    obj.localScale = scaleFactor;
    obj.localCenter = localCenter;

    obj.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexPositions), gl.STATIC_DRAW);
    obj.vertexBuffer.itemSize = 3;
    obj.vertexBuffer.numItems = data.vertexPositions.length / 3;

    obj.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexNormals), gl.STATIC_DRAW);
    obj.normalBuffer.itemSize = 3;
    obj.normalBuffer.numItems = data.vertexNormals.length / 3;

    obj.frontColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.frontColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexFrontcolors), gl.STATIC_DRAW);
    obj.frontColorBuffer.itemSize = 3;
    obj.frontColorBuffer.numItems = data.vertexFrontcolors.length / 3;

    obj.faceNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.faceNormalBuffer);
    
    // use vertex to calculate face normal
    var faceNormals = [];
    var p = data.vertexPositions;

    for (var i = 0; i < p.length; i += 9) {
        var v1 = vec3.create([p[i], p[i + 1], p[i + 2]]);
        var v2 = vec3.create([p[i + 3], p[i + 4], p[i + 5]]);
        var v3 = vec3.create([p[i + 6], p[i + 7], p[i + 8]]);

        var edge1 = vec3.create();
        var edge2 = vec3.create();
        var normal = vec3.create();

        vec3.subtract(v2, v1, edge1);
        vec3.subtract(v3, v1, edge2);
        vec3.cross(edge1, edge2, normal);
        vec3.normalize(normal);

        for (let j = 0; j < 3; j++) {
            faceNormals.push(normal[0], normal[1], normal[2]);
        }
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(faceNormals), gl.STATIC_DRAW);
    obj.faceNormalBuffer.itemSize = 3;
    obj.faceNormalBuffer.numItems = faceNormals.length / 3;

    // for texture
    if (data.vertexTextureCoords) {
        obj.textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.textureCoordBuffer);
        // normalize texture coordinates to [0, 1]
        minCoord = Math.min(...data.vertexTextureCoords);
        maxCoord = Math.max(...data.vertexTextureCoords);
        var normalizedCoords = data.vertexTextureCoords.map(coord => (coord - minCoord) / (maxCoord - minCoord));
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalizedCoords), gl.STATIC_DRAW);
        obj.textureCoordBuffer.itemSize = 2;
        obj.textureCoordBuffer.numItems = normalizedCoords.length / 2;
    }
}

function loadObjectRequest(idx, path) {
    path = "./model/" + path;
    var request = new XMLHttpRequest();
    request.open("GET", path);
    request.onreadystatechange = function () {
        if (request.readyState == 4) {
            LoadObject(idx, JSON.parse(request.responseText));
        }
    }
    request.send();

}

function loadAllObjects() {
    initObjects();
    for (let i = 0; i < NUM_OBJECTS; i++) {
        loadObjectRequest(i, objects_list[i]);
    }
}

function initObjects() {
    for (let i = 0; i < NUM_OBJECTS; i++) {
        objects.push({
            id: i,
            // material properties
            ka: 0.2,
            kd: 0.5,
            ks: 0.3,
            shininess: 10.0,
            // clip properties
            clipPlane: vec3.create([-20 + offsets[i], -20, -70]),
            // transformation properties
            transVec: vec3.create([0, 0, -50]),
            scaleVec: vec3.create([1, 1, 1]),
            localScale: 1,
            rotateVec: vec3.create([0, 0, 0]),
            shearVec: [0, 0, 0, 0, 0, 0],
            angle: 0,
            // data
            vertexBuffer: null,
            normalBuffer: null,
            frontColorBuffer: null,
            faceNormalBuffer: null,
            setMaterial: function (ka, kd, ks, shininess) {
                this.ka = ka;
                this.kd = kd;
                this.ks = ks;
                this.shininess = shininess;
            },
            useTexture: false,

        })
    }
}

function computeScaleAndCenter(vertices) {
    let min = vec3.create([Infinity, Infinity, Infinity]);
    let max = vec3.create([-Infinity, -Infinity, -Infinity]);
    for (let i = 0; i < vertices.length; i += 3) {
        min[0] = Math.min(min[0], vertices[i]);
        min[1] = Math.min(min[1], vertices[i + 1]);
        min[2] = Math.min(min[2], vertices[i + 2]);

        max[0] = Math.max(max[0], vertices[i]);
        max[1] = Math.max(max[1], vertices[i + 1]);
        max[2] = Math.max(max[2], vertices[i + 2]);
    }
    var size = vec3.create();
    vec3.subtract(max, min, size);
    const maxSize = Math.max(size[0], size[1], size[2]);

    let center = vec3.create([
        (min[0] + max[0]) * size[0] * 10,
        (min[1] + max[1]) * size[1] * 10,
        (min[2] + max[2]) * size[2] * 10
    ]);

    return [20 / maxSize, center];
}


function createTextures() {
    for (let i = 0; i < texture_list.length; i++) {
        let image = new Image();
        image.onload = function () {
            let tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.bindTexture(gl.TEXTURE_2D, null);
            textures[i] = tex;
        };
        image.src = "./model/textures/" + texture_list[i];
    }
}



//*************************************************
// Rendering functions
//*************************************************
/*
    TODO HERE:
    add two or more objects showing on the canvas
    (it needs at least three objects showing at the same time)
*/
function drawScene() {

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Setup Projection Matrix
    mat4.perspective(camera.fov, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    let viewMatrix = mat4.create();
    mat4.lookAt(camera.eye, camera.at, camera.up, viewMatrix);

    for (let i = 0; i < NUM_OBJECTS; i++) {
        var obj = objects[i];

        if (obj.vertexBuffer == null ||
            obj.normalBuffer == null ||
            obj.frontColorBuffer == null ||
            obj.faceNormalBuffer == null) {
            return;
        }


        // Model matrix
        var modelMatrix = mat4.create();
        mat4.identity(modelMatrix);

        // Object offset
        mat4.translate(modelMatrix, offsets[i]); // M = T'

        // Translate
        mat4.translate(modelMatrix, obj.transVec); // M = T * T'

        // Reverse translate from center
        mat4.translate(modelMatrix, [obj.localCenter[0], obj.localCenter[1], obj.localCenter[2]]); // M = TC' * T * T'

        // Rotate
        mat4.rotate(modelMatrix, degToRad(init_rotation[i][0]), [1, 0, 0]);
        mat4.rotate(modelMatrix, degToRad(init_rotation[i][1]), [0, 1, 0]);
        mat4.rotate(modelMatrix, degToRad(init_rotation[i][2]), [0, 0, 1]);

        let rotateVec = obj.rotateVec;
        mat4.rotate(modelMatrix, degToRad(rotateVec[0]), [1, 0, 0]);
        mat4.rotate(modelMatrix, degToRad(rotateVec[1]), [0, 1, 0]);
        mat4.rotate(modelMatrix, degToRad(rotateVec[2]), [0, 0, 1]); // M = R * T * T'

        // Translate to center to rotate
        mat4.translate(modelMatrix, [-obj.localCenter[0], -obj.localCenter[1], -obj.localCenter[2]]); // M = TC * R * T * T'

        // Local scale
        mat4.scale(modelMatrix, [obj.localScale, obj.localScale, obj.localScale]); // M = S' * R * T * T'

        // Scale
        mat4.scale(modelMatrix, obj.scaleVec); // M = S * S' * R * T * T'

        // Shear
        var shearMatrix = mat4.create();
        let shearVec = obj.shearVec;
        shearMatrix[0] = 1, shearMatrix[4] = shearVec[0], shearMatrix[8] = shearVec[1], shearMatrix[12] = 0;
        shearMatrix[1] = shearVec[2], shearMatrix[5] = 1, shearMatrix[9] = shearVec[3], shearMatrix[13] = 0;
        shearMatrix[2] = shearVec[4], shearMatrix[6] = shearVec[5], shearMatrix[10] = 1, shearMatrix[14] = 0;
        shearMatrix[3] = 0, shearMatrix[7] = 0, shearMatrix[11] = 0, shearMatrix[15] = 1;
        mat4.multiply(modelMatrix, shearMatrix); // M = Sh * R * T * T'

        mat4.multiply(viewMatrix, modelMatrix, mvMatrix); // MV = M * V =  (Sh * S * S' * R * T * T') * V

        // outline
        if (shading_mode == 3) {
            selectShader(4);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);

            setMatrixUniforms();

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute,
                obj.vertexBuffer.itemSize,
                gl.FLOAT,
                false,
                0,
                0);

            gl.uniform1f(gl.getUniformLocation(shaderProgram, "outlineWidth"), 0.05 / obj.localScale);

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, obj.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, obj.frontColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

            // Setup clip vector
            var clipPlanes = [];
            for (let axis = 0; axis < 3; axis++) {
                var p = new Float32Array([clipNormals[axis][0] * obj.clipPlane[axis], clipNormals[axis][1] * obj.clipPlane[axis], clipNormals[axis][2] * obj.clipPlane[axis], 1.0]);
                var n = new Float32Array([clipNormals[axis][0], clipNormals[axis][1], clipNormals[axis][2], 0.0]);
                vec4.transformMat4(p, p, viewMatrix);
                vec4.transformMat4(n, n, viewMatrix);
                p = p.slice(0, 3);
                n = n.slice(0, 3);
                var d = -vec3.dot(n, p); // dot(n, p) + d = 0
                clipPlanes.push(n[0], n[1], n[2], d);
            }
            gl.uniform4fv(shaderProgram.clipPlane, clipPlanes);

            gl.drawArrays(gl.TRIANGLES, 0, obj.vertexBuffer.numItems);

            gl.disable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);

            selectShader(3);
        }

        setMatrixUniforms();

        // Setup teapot position data
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute,
            obj.vertexBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0);

        // Setup teapot front color data
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.frontColorBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexFrontColorAttribute,
            obj.frontColorBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0);

        if (shaderProgram.vertexNormalAttribute != -1) {
            // Setup teapot normal data
            gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute,
                obj.normalBuffer.itemSize,
                gl.FLOAT,
                false,
                0,
                0);

        }

        if (shaderProgram.faceNormalAttribute != -1) {
            // Setup teapot face normal data
            gl.bindBuffer(gl.ARRAY_BUFFER, obj.faceNormalBuffer);
            gl.vertexAttribPointer(shaderProgram.faceNormalAttribute,
                obj.faceNormalBuffer.itemSize,
                gl.FLOAT,
                false,
                0,
                0);

        }

        // Setup clip vector
        var clipPlanes = [];
        for (let axis = 0; axis < 3; axis++) {
            var p = new Float32Array([clipNormals[axis][0] * obj.clipPlane[axis], clipNormals[axis][1] * obj.clipPlane[axis], clipNormals[axis][2] * obj.clipPlane[axis], 1.0]);
            var n = new Float32Array([clipNormals[axis][0], clipNormals[axis][1], clipNormals[axis][2], 0.0]);
            vec4.transformMat4(p, p, viewMatrix);
            vec4.transformMat4(n, n, viewMatrix);
            p = p.slice(0, 3);
            n = n.slice(0, 3);
            var d = -vec3.dot(n, p); // dot(n, p) + d = 0
            clipPlanes.push(n[0], n[1], n[2], d);
        }
        gl.uniform4fv(shaderProgram.clipPlane, clipPlanes);



        // Setup ambient light and light position and color
        gl.uniform1f(shaderProgram.ka, obj.ka);
        gl.uniform1f(shaderProgram.kd, obj.kd);
        gl.uniform1f(shaderProgram.ks, obj.ks);
        gl.uniform1f(shaderProgram.shininess, obj.shininess);

        gl.uniform3fv(shaderProgram.lightLoc, lightLoc);
        gl.uniform3fv(shaderProgram.lightColor, lightColor);

        // texture 
        gl.uniform1i(shaderProgram.useTexture, obj.useTexture ? 1 : 0);

        if (shaderProgram.vertexTextureCoordAttribute && obj.textureCoordBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, obj.textureCoordBuffer);
            gl.vertexAttribPointer(shaderProgram.vertexTextureCoordAttribute,
                obj.textureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
        }

        if (obj.useTexture && obj.texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, obj.texture);
            gl.uniform1i(shaderProgram.textureUniform, 0);
        }
        else {
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // draw
        gl.drawArrays(gl.TRIANGLES, 0, obj.vertexBuffer.numItems);

    }

}

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var elapsed = timeNow - lastTime;
        // for (let i = 0; i < NUM_OBJECTS; i++) {
        //     objects[i].angle += 0.03 * elapsed;
        // }
    }

    lastTime = timeNow;
}

function tick() {
    requestAnimFrame(tick);
    drawScene();
    animate();
}

function createLightControlUI() {
    const container = document.getElementById("light-controls");
    container.innerHTML = "";

    for (let i = 0; i < NUM_LIGHTS; i++) {
        const block = document.createElement("div");
        block.className = "light-block spacer";

        block.innerHTML = `
            <fieldset>
                <legend>Light ${i}</legend>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <th colspan="3">Position</th>
                        <th>Color</th>
                    </tr>
                    <tr>
                        <td>X axis</td>
                        <td>Y axis</td>
                        <td>Z axis</td>
                    </tr>
                    <tr>
                        <td><input id="light${i}_llocX" type="range" min="-200" max="200" step="1" value="${-200 + 400 * (i)}"</td>
                        <td><input id="light${i}_llocY" type="range" min="-200" max="200" step="1" value="${-200 + 400 * (i)}"</td>
                        <td><input id="light${i}_llocZ" type="range" min="-200" max="200" step="1" value="${-200 + 400 * (i)}"</td>
                        <td rowspan="2" style="text-align: center; vertical-align: middle;">
                            <input type="color" id="light${i}_color" value="#ffffff" style="width: 50px; height: 30px; border: none;" />
                        </td>
                    </tr>
                </table>
            </fieldset>
        `;
        container.appendChild(block);
    }
}

function createObjectControlUI() {
    const container = document.getElementById(`object-controls`);
    container.innerHTML = "";
    for (let i = 0; i < NUM_OBJECTS; i++) {

        objectHTML = `
            <div class="spacer">
                <details class="object-control">
                    <summary><strong>Object ${i}</strong></summary>
                    <div id="object${i}-transform"></div>
                    <fieldset class="material-section">
                        <legend>Material</legend>
                        <table class="coeff-table">
                            <tr>
                                <td class="label">Ka:</td>
                                <td class="slider-cell">
                                    <input id="Ka_${i}" type="range" value="0.2" min="0" max="1" step="0.01">
                                </td>
                            </tr>
                            <tr>
                                <td class="label">Kd:</td>
                                <td class="slider-cell">
                                    <input id="Kd_${i}" type="range" value="0.6" min="0" max="1" step="0.01">
                                </td>
                            </tr>
                            <tr>
                                <td class="label">Ks:</td>
                                <td class="slider-cell">
                                    <input id="Ks_${i}" type="range" value="0.3" min="0" max="1" step="0.01">
                                </td>
                            </tr>
                            <tr>
                                <td class="label">Shininess:</td>
                                <td class="slider-cell">
                                    <input id="Shininess_${i}" type="range" value="10" min="1" max="100" step="1">
                                </td>
                            </tr>
                        </table>
                    </fieldset> </br>
                    ${i == 0 ? `<fieldset  class="texture-section">
                        <legend>Texture</legend>
                        <label>
                            <input type="checkbox" id="texture_enable">
                            Enable Texture
                        </label> 
                        <label>
                            <select id="texture_select">
                                <option value="0">Wood</option>
                                <option value="1">InkPaint</option>
                                <option value="2">Grunge</option>
                            </select>
                        </label>
                    </fieldset> </br>` : ""}
                    <fieldset>
                        <legend>Transform</legend>
                        <table class="transform-table">
                            <tr>
                                <th></th>
                                <th>X axis</th>
                                <th>Y axis</th>
                                <th>Z axis</th>
                            </tr>
                            <tr>
                                <td>Clip:</td>
                                <td><input id="clipX_${i}" type="range" value="-20" min="-20" max="20"></td>
                                <td><input id="clipY_${i}" type="range" value="-20" min="-20" max="20"></td>
                                <td><input id="clipZ_${i}" type="range" value="-70" min="-100" max="-30"></td>
                            </tr>
                            <tr>
                                <td>Translate:</td>
                                <td><input id="transX_${i}" type="range" value="0" min="-10" max="10"></td>
                                <td><input id="transY_${i}" type="range" value="0" min="-10" max="10"></td>
                                <td><input id="transZ_${i}" type="range" value="-50" min="-100" max="-30"></td>
                            </tr>
                            <tr>
                                <td>Rotate:</td>
                                <td><input id="rotateX_${i}" type="range" value="0" min="-180" max="180"></td>
                                <td><input id="rotateY_${i}" type="range" value="0" min="-180" max="180"></td>
                                <td><input id="rotateZ_${i}" type="range" value="0" min="-180" max="180"></td>
                            </tr>
                            <tr>
                                <td>Scale:</td>
                                <td><input id="scaleX_${i}" type="range" value="1" min="0.1" max="3" step="0.1"></td>
                                <td><input id="scaleY_${i}" type="range" value="1" min="0.1" max="3" step="0.1"></td>
                                <td><input id="scaleZ_${i}" type="range" value="1" min="0.1" max="3" step="0.1"></td>
                            </tr>
                            <tr>
                                <td class="shear-label">Shear:</td>
                                <td class="shear-cell">
                                    <div class="shear-group">
                                        <label for="shearXY_${i}">X by Y</label>
                                        <input id="shearXY_${i}" type="range" value="0" min="-10" max="10" step="0.01">
                                    </div>
                                    <div class="shear-group">
                                        <label for="shearXZ_${i}">X by Z</label>
                                        <input id="shearXZ_${i}" type="range" value="0" min="-10" max="10" step="0.01">
                                    </div>
                                </td>
                                <td class="shear-cell">
                                    <div class="shear-group">
                                        <label for="shearYZ_${i}">Y by Z</label>
                                        <input id="shearYZ_${i}" type="range" value="0" min="-10" max="10" step="0.01">
                                    </div>
                                    <div class="shear-group">
                                        <label for="shearYX_${i}">Y by X</label>
                                        <input id="shearYX_${i}" type="range" value="0" min="-10" max="10" step="0.01">
                                    </div>
                                </td>
                                <td class="shear-cell">
                                    <div class="shear-group">
                                        <label for="shearZX_${i}">Z by X</label>
                                        <input id="shearZX_${i}" type="range" value="0" min="-10" max="10" step="0.01">
                                    </div>
                                    <div class="shear-group">
                                        <label for="shearZY_${i}">Z by Y</label>
                                        <input id="shearZY_${i}" type="range" value="0" min="-10" max="10" step="0.01">
                                    </div>
                                </td>
                            </tr>

                        </table>
                    </fieldset>
                    
                </details>
                    `;
        container.innerHTML += objectHTML;
    }
}

function registerUIevents() {
    // shading mode
    document.querySelectorAll('input[name="shading_mode"]').forEach(radio => {
        radio.addEventListener("change", update_shading_mode);
    });
    update_shading_mode();

    // light location
    for (let i = 0; i < NUM_LIGHTS; i++) {
        ["X", "Y", "Z"].forEach(axis => {
            document.getElementById(`light${i}_lloc${axis}`).addEventListener("input", update_light_location);
        });
    }
    update_light_location();
    // light color
    for (let i = 0; i < NUM_LIGHTS; i++) {
        document.getElementById(`light${i}_color`).addEventListener("input", update_light_color);
    }
    update_light_color();

    // texture
    document.getElementById(`texture_enable`).addEventListener("change", update_texture);
    document.getElementById(`texture_select`).addEventListener("change", update_texture);

    for (let i = 0; i < NUM_OBJECTS; i++) {
        // material coefficients
        ["Ka", "Kd", "Ks", "Shininess"].forEach(id => {
            document.getElementById(`${id}_${i}`).addEventListener("input", update_material_coefficients);
        });

        // clip
        ["X", "Y", "Z"].forEach(axis => {
            document.getElementById(`clip${axis}_${i}`).addEventListener("input", update_clip);
        });
        // translate
        ["X", "Y", "Z"].forEach(axis => {
            document.getElementById(`trans${axis}_${i}`).addEventListener("input", update_trans);
        });
        // rotate
        ["X", "Y", "Z"].forEach(axis => {
            document.getElementById(`rotate${axis}_${i}`).addEventListener("input", update_rotate);
        });
        // scale
        ["X", "Y", "Z"].forEach(axis => {
            document.getElementById(`scale${axis}_${i}`).addEventListener("input", update_scale);
        });
        // shear
        ["XY", "XZ", "YX", "YZ", "ZX", "ZY"].forEach(pair => {
            document.getElementById(`shear${pair}_${i}`).addEventListener("input", update_shear);
        });
    }
    document.addEventListener('keydown', handleCameraControl);
    document.addEventListener('mousedown', handleMouseControl);
    document.addEventListener('mousemove', handleMouseControl);
    document.addEventListener('mouseup', handleMouseControl);
    document.addEventListener('mouseout', handleMouseControl);

    update_texture();


}

function webGLStart() {
    createLightControlUI();
    createObjectControlUI();
    var canvas = document.getElementById("ICG-canvas");
    initGL(canvas);
    createTextures();
    const ext = gl.getExtension("OES_standard_derivatives");
    initShaders(shader_list).then(() => {
        loadAllObjects();
        registerUIevents();
        gl.clearColor(0.2, 0.2, 0.2, 1.0);
        gl.enable(gl.DEPTH_TEST);
        tick();
    });
}


//*************************************************
// Parsing parameters
//*************************************************


function update_light_location() {
    let loc = new Float32Array(NUM_LIGHTS * 3);
    for (let i = 0; i < NUM_LIGHTS; i++) {
        loc[i * 3] = document.getElementById("light" + i + "_llocX").value;
        loc[i * 3 + 1] = document.getElementById("light" + i + "_llocY").value;
        loc[i * 3 + 2] = document.getElementById("light" + i + "_llocZ").value;
    }
    lightLoc = loc;
}

function update_light_color() {
    let color = new Float32Array(NUM_LIGHTS * 3);
    for (let i = 0; i < NUM_LIGHTS; i++) {
        let c = hexToRgb(document.getElementById("light" + i + "_color").value);
        color[i * 3] = c[0] / 255;
        color[i * 3 + 1] = c[1] / 255;
        color[i * 3 + 2] = c[2] / 255;
    }
    lightColor = color;
}

function hexToRgb(hex) {
    // Remove #
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
        hex = hex.split("").map(h => h + h).join("");
    }
    let bigint = parseInt(hex, 16);
    return [
        (bigint >> 16) & 255,  // R
        (bigint >> 8) & 255,   // G
        bigint & 255           // B
    ];
}

function update_material_coefficients() {
    for (let i = 0; i < NUM_OBJECTS; i++) {
        let Ka = document.getElementById("Ka_" + i).value;
        let Kd = document.getElementById("Kd_" + i).value;
        let Ks = document.getElementById("Ks_" + i).value;
        let Shininess = document.getElementById("Shininess_" + i).value;
        objects[i].setMaterial(Ka, Kd, Ks, Shininess);
    }
}

function update_clip() {
    for (let i = 0; i < NUM_OBJECTS; i++) {
        var clipX = parseInt(document.getElementById("clipX_" + i).value);
        var clipY = parseInt(document.getElementById("clipY_" + i).value);
        var clipZ = parseInt(document.getElementById("clipZ_" + i).value);
        objects[i].clipPlane = vec3.create([clipX + offsets[i][0], clipY, clipZ]);
    }
}

function update_trans() {
    for (let i = 0; i < NUM_OBJECTS; i++) {
        var tx = parseInt(document.getElementById("transX_" + i).value);
        var ty = parseInt(document.getElementById("transY_" + i).value);
        var tz = parseInt(document.getElementById("transZ_" + i).value);
        objects[i].transVec = vec3.create([tx, ty, tz]);
    }
}

function update_rotate() {
    for (let i = 0; i < NUM_OBJECTS; i++) {
        var rx = document.getElementById("rotateX_" + i).value;
        var ry = document.getElementById("rotateY_" + i).value;
        var rz = document.getElementById("rotateZ_" + i).value;

        objects[i].rotateVec = vec3.create([rx, ry, rz]);
    }
}

function update_scale() {
    for (let i = 0; i < NUM_OBJECTS; i++) {
        var sx = document.getElementById("scaleX_" + i).value;
        var sy = document.getElementById("scaleY_" + i).value;
        var sz = document.getElementById("scaleZ_" + i).value;

        objects[i].scaleVec = vec3.create([sx, sy, sz]);
    }
}

function update_shear() {
    // h = tan(theta)
    for (let i = 0; i < NUM_OBJECTS; i++) {
        var hxy = document.getElementById("shearXY_" + i).value;
        var hxz = document.getElementById("shearXZ_" + i).value;
        var hyx = document.getElementById("shearYX_" + i).value;
        var hyz = document.getElementById("shearYZ_" + i).value;
        var hzx = document.getElementById("shearZX_" + i).value;
        var hzy = document.getElementById("shearZY_" + i).value;

        objects[i].shearVec = [hxy, hxz, hyx, hyz, hzx, hzy];
    }
}

function update_shading_mode() {
    const radios = document.getElementsByName("shading_mode");
    for (let radio of radios) {
        if (radio.checked) {
            selectShader(parseInt(radio.value));
            break;
        }
    }
}

// change shader
function selectShader(mode) {
    shading_mode = mode;
    console.log('select shader: ' + shader_list[mode]);
    shaderProgram = shader_program_list[mode];
    gl.useProgram(shaderProgram);
}

function handleCameraControl(event) {
    const step = 1;

    // forward = lookat - eye
    const forward = vec3.create();
    vec3.subtract(camera.at, camera.eye, forward);
    vec3.normalize(forward, forward);

    // right = forward x up
    const right = vec3.create();
    vec3.cross(forward, camera.up, right);
    vec3.normalize(right, right);

    // up = right x forward
    const up = vec3.create();
    vec3.cross(right, forward, up);
    vec3.normalize(up, up);

    switch (event.key) {
        case 'w': // forward
            vec3.scale(forward, step, forward);
            vec3.add(camera.eye, forward, camera.eye);
            vec3.add(camera.at, forward, camera.at);
            break;
        case 's': // backward
            vec3.scale(forward, -step, forward);
            vec3.add(camera.eye, forward, camera.eye);
            vec3.add(camera.at, forward, camera.at);
            break;
        case 'a': // left
            vec3.scale(right, -step, right);
            vec3.add(camera.eye, right, camera.eye);
            vec3.add(camera.at, right, camera.at);
            break;
        case 'd': // right
            vec3.scale(right, step, right);
            vec3.add(camera.eye, right, camera.eye);
            vec3.add(camera.at, right, camera.at);
            break;
        case 'q': // down
            vec3.scale(up, -step, up);
            vec3.add(camera.eye, up, camera.eye);
            vec3.add(camera.at, up, camera.at);
            break;
        case 'e': // up
            vec3.scale(up, step, up);
            vec3.add(camera.eye, up, camera.eye);
            vec3.add(camera.at, up, camera.at);
            break;
    }
}

var lastX = 0, lastY = 0, isDragging = false;
function handleMouseControl(event) {
    switch (event.type) {
        case "mousedown":
            if (isMouseInCanvas(event)) {
                lastX = event.clientX;
                lastY = event.clientY;
                isDragging = true;
            }
            break;

        case "mousemove":
            if (isDragging && isMouseInCanvas(event)) {
                const dx = event.clientX - lastX;
                const dy = event.clientY - lastY;
                lastX = event.clientX;
                lastY = event.clientY;

                const sensitivity = 0.0005;

                var front = vec3.create();
                vec3.subtract(camera.at, camera.eye, front);
                vec3.normalize(front, front);

                // Rotation around up
                var up = mat4.create();
                mat4.identity(up);
                mat4.rotate(up, dx * sensitivity, camera.up);

                var rotatedUp = vec3.create();
                vec3.transformMat4(rotatedUp, front, up);

                // Rotation around right 
                var right = vec3.create();
                vec3.cross(rotatedUp, camera.up, right);
                vec3.normalize(right, right);

                var rotatedRight = mat4.create();
                mat4.identity(rotatedRight);
                mat4.rotate(rotatedRight, dy * sensitivity, right);

                front = vec3.create();
                vec3.transformMat4(front, rotatedUp, rotatedRight);

                vec3.add(camera.eye, front, camera.at);
            }
            break;

        case "mouseup":
        case "mouseout":
            isDragging = false;
            break;
    }
}

function isMouseInCanvas(event) {
    const canvas = document.getElementById("ICG-canvas");
    const rect = canvas.getBoundingClientRect();

    return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
    );
}

function update_texture() {
    let obj = objects[0];
    let enabled = document.getElementById(`texture_enable`).checked;
    let selectedTexture = document.getElementById(`texture_select`).value;
    obj.useTexture = enabled;
    if (enabled) {
        obj.texture = textures[selectedTexture];
    } else {
        obj.texture = null;
    }
}


vec3.transformMat4 = function (out, a, m) {
    const x = a[0], y = a[1], z = a[2], w = 1.0;
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    return out;
};

vec4 = {};
vec4.transformMat4 = function (out, a, m) {
    const x = a[0], y = a[1], z = a[2], w = a[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
};
