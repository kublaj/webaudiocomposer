(function() {
    var STOCK_AREA_HEIGHT = 200;
    var PORT_RADIUS = 4;
    var REMOVE_BUTTON_SIZE = 8;
    var PATCH_WIDTH = 100;
    var PATCH_HEIGHT = 80;

    var stage, stockArea, compositeArea, activeConnection;
    var audioContext, mediaNode,  graphics;
    var selectedPatch = null;

    var nodeSpec = {
        MediaElementAudioSource : {
            label : 'media',
            stockPos : {x : 60, y : 50},
            maxInstance : 1,
            pane : '#mediaElementAudioSourceParams',
            build : function() { return mediaNode; }
        },
        Oscillator : {
            label : 'oscillator',
            stockPos : {x : 180, y : 50},
            maxInstance : Number.MAX_VALUE,
            pane : '#oscillatorParams',
            build : function() { return audioContext.createOscillator(); }
        },
        Gain : {
            label : 'gain',
            stockPos : {x : 300, y : 50},
            maxInstance : Number.MAX_VALUE,
            pane : '#gainParams',
            build : function() { return audioContext.createGain(); }
        },
        ChannelSplitter : {
            label : 'split',
            stockPos : {x : 420, y : 50},
            maxInstance : Number.MAX_VALUE,
            pane : '#channelSplitterParams',
            build : function() { return audioContext.createChannelSplitter(); }
        },
        ChannelMerger : {
            label : 'merge',
            stockPos : {x : 540, y : 50},
            maxInstance : Number.MAX_VALUE,
            pane : '#channelMergerParams',
            build : function() { return audioContext.createChannelMerger(); }
        },
        BiquadFilter : {
            label : 'biquad',
            stockPos : {x : 660, y : 50},
            maxInstance : Number.MAX_VALUE,
            pane : '#biquadFilterParams',
            build : function() { return audioContext.createBiquadFilter(); }
        },
        AudioDestination : {
            label : 'dest',
            stockPos : {x : 780, y : 50},
            maxInstance : 1,
            pane : '#audioDestinationParams',
            build : function() { return audioContext.destination; }
        }
    };
    var channelLabels = ['L', 'R', 'C', 'LFE', 'SL', 'SR'];

    Rectangle.prototype.includes = function(x, y) {
        return this.x <= x && x < this.x + this.width && this.y <= y && y < this.y + this.height;
    }

    function setupStage() {
        var type, patch, workspace;
        
        audioContext = new AudioContext();
        mediaNode = audioContext.createMediaElementSource(document.getElementById('music'));
        workspace = document.getElementById('workspace');

        stage = new Stage('mainStage');
        stage.canvas.width = workspace.offsetWidth;
        stage.canvas.height = workspace.offsetHeight;

        compositeArea = CompositeArea(stage.canvas.width, stage.canvas.height - STOCK_AREA_HEIGHT);
        compositeArea.x = 0;
        compositeArea.y = 0;
        stage.addChild(compositeArea);

        stockArea = StockArea(stage.canvas.width, STOCK_AREA_HEIGHT);
        stockArea.x = 0;
        stockArea.y = stage.canvas.height - STOCK_AREA_HEIGHT;
        stage.addChild(stockArea);

        for (type in nodeSpec) {
            patch = Patch(type);
            patch.x = nodeSpec[type].stockPos.x;
            patch.y = nodeSpec[type].stockPos.y;
            stockArea.addChild(patch);
        }

        graphics = new createjs.Graphics();

        Ticker.timingMode = Ticker.RAF;
        Ticker.setFPS(60);
        Ticker.addEventListener('tick', onTick);
    }

    function onTick(event) {
        var i, j, k, patch, inputPort, outputPort, op, ip;

        stage.update();

        graphics.clear();
        if (activeConnection) {
            drawConnection(graphics,
                    activeConnection.outputX,
                    activeConnection.outputY,
                    activeConnection.inputX,
                    activeConnection.inputY);
        }
        for (i = 0; i < compositeArea.patches.getNumChildren(); i++) {
            patch = compositeArea.patches.children[i];
            for (j = 0; j < patch.inputPorts.getNumChildren(); j++) {
                inputPort = patch.inputPorts.children[j];
                for (k = 0; k < inputPort.peers.length; k++) {
                    outputPort = inputPort.peers[k];
                    op = outputPort.localToGlobal(0, 0);
                    ip = inputPort.localToGlobal(0, 0);
                    drawConnection(graphics, op.x, op.y, ip.x, ip.y);
                }
            }
        }
        graphics.draw(stage.canvas.getContext('2d'));
    }

    function CompositeArea(width, height) {
        var area, selectedPane = null;

        function getPatchUnderPoint(x, y) {
            var patch, i, local, result = null;
            for (i = 0; i < area.patches.getNumChildren(); i++) {
                patch = area.patches.children[i];
                local = area.localToLocal(x, y, patch);
                if (patch.getBounds().includes(local.x, local.y)) {
                    result = patch;
                    break;
                }
            }
            return result;
        }
        function onClick(event) {
            var local, patch;

            if (selectedPane) {
                selectedPane.style.display = 'none';
            }

            local = area.globalToLocal(event.stageX, event.stageY);
            patch = getPatchUnderPoint(local.x, local.y);
            if (patch) {
                selectedPane = document.querySelector(nodeSpec[patch.nodeType].pane);
                selectedPatch = patch;
                refreshPane(patch);
            } else {
                selectedPane = null;
                selectedPatch = null;
            }

            if (selectedPane) {
                selectedPane.style.display = 'block';
            }

            event.preventDefault();
        }
        function patchCount(type) {
            return area.patches.children
                .map(function(patch) { return patch.nodeType === type; })
                .reduce(function(prev, curr) { return prev + curr; }, 0);
        }

        area = new Container();
        area.setBounds(0, 0, width, height);
        area.getPatchUnderPoint = getPatchUnderPoint;
        area.patchCount = patchCount;
        area.addEventListener('click', onClick);

        // This shape is needed for correctly tracking mouse event.
        area.background = new Shape();
        area.background.hitArea = new Shape();
        area.background.hitArea.graphics.beginFill('#000').drawRect(0, 0, width, height);
        area.addChild(area.background);

        area.trashbox = new Bitmap('trashbox.png');
        area.trashbox.x = width - 25;
        area.trashbox.y = 5;
        area.addChild(area.trashbox);

        area.patches = new Container();
        area.addChild(area.patches);

        return area;
    }

    function StockArea(width, height) {
        var area;

        area = new Container();
        area.setBounds(0, 0, width, height);

        area.background = new Shape();
        area.background.graphics.beginFill('rgba(80,80,80, 0.5)').drawRect(0, 0, width, height);
        area.addChild(area.background);

        return area;
    }

    function Patch(type) {
        var patch, port, i;
        var label, x, y;
        var spec = nodeSpec[type];

        function onMouseDown1(event) {

            stockArea.removeChild(patch);

            stage.addChild(patch);
            patch.x = event.stageX;
            patch.y = event.stageY;

            patch.addEventListener('pressmove', onPressMove1);
            patch.addEventListener('pressup', onPressUp1);
        }
        function onPressMove1(event) {
            patch.x = event.stageX;
            patch.y = event.stageY;
        }
        function onPressUp1(event) {
            var local, returnPos, bounds, newPatch;

            patch.removeEventListener('pressup', onPressUp1);
            patch.removeEventListener('pressmove', onPressMove1);

            local = compositeArea.globalToLocal(event.stageX, event.stageY);
            if (compositeArea.getBounds().includes(local.x, local.y) &&
                compositeArea.patchCount(type) < nodeSpec[type].maxInstance) {

                patch.removeEventListener('mousedown', onMouseDown1);
                patch.addEventListener('pressmove', onPressMove2);
                patch.addEventListener('pressup', onPressUp2);

                patch.x = local.x;
                patch.y = local.y;
                stage.removeChild(patch);
                compositeArea.patches.addChild(patch);

                newPatch = Patch(type);
                newPatch.x = spec.stockPos.x;
                newPatch.y = spec.stockPos.y;
                stockArea.addChild(newPatch);
            } else {
                returnPos = stockArea.localToGlobal(spec.stockPos.x, spec.stockPos.y);
                Tween.get(patch).to({x : returnPos.x, y : returnPos.y}, 400, Ease.elasticOut).call(function() {
                    stage.removeChild(patch);
                    stockArea.addChild(patch);
                    patch.x = spec.stockPos.x;
                    patch.y = spec.stockPos.y;
                });
            }
        }
        function onPressMove2(event) {
            var local = compositeArea.globalToLocal(event.stageX, event.stageY);
            if (compositeArea.getBounds().includes(local.x, local.y)) {
                patch.x = event.stageX;
                patch.y = event.stageY;
            }

            if (intersect(patch, compositeArea.trashbox)) {
                patch.alpha = 0.5;
            } else {
                patch.alpha = 1.0;
            }
        }
        function onPressUp2(event) {
            if (patch.alpha !== 1.0) {
                remove();
            }
        }
        function getOutputPortUnderPoint(x, y) {
            var port, i, local, result = null;
            for (i = 0; i < patch.outputPorts.getNumChildren(); i++) {
                port = patch.outputPorts.children[i];
                local = patch.localToLocal(x, y, port);
                if (port.getBounds().includes(local.x, local.y)) {
                    result = port;
                    break;
                }
            }
            return result;
        }
        function getInputPortUnderPoint(x, y) {
            var port, i, local, result = null;
            for (i = 0; i < patch.inputPorts.getNumChildren(); i++) {
                port = patch.inputPorts.children[i];
                local = patch.localToLocal(x, y, port);
                if (port.getBounds().includes(local.x, local.y)) {
                    result = port;
                    break;
                }
            }
            return result;
        }
        function bgColor() {
            var color;
            if (patch.node.numberOfInputs === 0) {
                color = '#f66';
            } else if (patch.node.numberOfOutputs === 0) {
                color = '#26f';
            } else {
                color = '#2f6';
            }
            return color;
        }
        function remove() {
            var i;

            compositeArea.patches.removeChild(patch);

            for (i = 0; i < patch.outputPorts.getNumChildren(); i++) {
                patch.outputPorts.children[i].disconnect();
            }
            for (i = 0; i < patch.inputPorts.getNumChildren(); i++) {
                patch.inputPorts.children[i].disconnect();
            }

            cleanupNode();
        }
        function setupNode() {
            if (patch.nodeType === 'Oscillator') {
                patch.node.start();
            }
        }
        function cleanupNode() {
            if (patch.nodeType === 'Oscillator') {
                patch.node.stop();
            }
        }

        patch = new Container();
        patch.nodeType = type;
        patch.node = spec.build();
        patch.alpha = 0;
        patch.setBounds(-PATCH_WIDTH / 2, -PATCH_HEIGHT / 2, PATCH_WIDTH, PATCH_HEIGHT);

        patch.getOutputPortUnderPoint = getOutputPortUnderPoint;
        patch.getInputPortUnderPoint = getInputPortUnderPoint;

        patch.background = new Shape();
        patch.background.graphics.beginFill(bgColor()).drawRoundRect(-PATCH_WIDTH / 2, -PATCH_HEIGHT / 2, PATCH_WIDTH, PATCH_HEIGHT, 5);
        patch.addChild(patch.background);

        patch.nameLabel = new Text(spec.label, 'normal 18px sanserif', '#444');
        patch.nameLabel.x = patch.getBounds().x + (patch.getBounds().width - patch.nameLabel.getBounds().width) / 2;
        patch.nameLabel.y = patch.getBounds().y;
        patch.addChild(patch.nameLabel);

        patch.inputPorts = new Container();
        patch.addChild(patch.inputPorts);

        patch.outputPorts = new Container();
        patch.addChild(patch.outputPorts);

        for (i = 0; i < patch.node.numberOfInputs; i++) {
            x = 8 - patch.getBounds().width / 2;
            y = (i + 1) * patch.getBounds().height / (patch.node.numberOfInputs + 1) - patch.getBounds().height / 2;

            port = Port('input', i);
            port.x = x;
            port.y = y;
            patch.inputPorts.addChild(port);

            if (type === 'ChannelMerger') {
                label = new Text(channelLabels[i], 'normal 8px monotype', '#000');
                label.x = x + 8;
                label.y = y - 4;
                patch.addChild(label);
            }
        }

        for (i = 0; i < patch.node.numberOfOutputs; i++) {
            x = patch.getBounds().width / 2 - 8;
            y = (i + 1) * patch.getBounds().height / (patch.node.numberOfOutputs + 1) - patch.getBounds().height / 2;

            port = Port('output', i);
            port.x = x;
            port.y = y;
            patch.outputPorts.addChild(port);

            if (type === 'ChannelSplitter') {
                label = new Text(channelLabels[i], 'normal 8px monotype', '#000');
                label.x = x - 8 - label.getBounds().width;
                label.y = y - 4;
                patch.addChild(label);
            }
        }

        setupNode();

        Tween.get(patch).to({alpha : 1.0}, 200).call(function() {
            patch.addEventListener('mousedown', onMouseDown1);
        });

        return patch;
    }

    function Port(type, channel) {
        var port;

        function onMouseDown(event) {

            if (!isDeployed(port)) {
                return;
            }

            port.addEventListener('pressmove', onPressMove);
            port.addEventListener('pressup', onPressUp);

            activeConnection = {
                inputX : event.stageX,
                inputY : event.stageY,
                outputX : event.stageX,
                outputY : event.stageY
            };

            event.stopPropagation();
        }
        function onPressUp(event) {
            var local, patch, hitPort = null;

            port.removeEventListener('pressup', onPressUp);
            port.removeEventListener('pressmove', onPressMove);

            activeConnection = null;

            local = compositeArea.globalToLocal(event.stageX, event.stageY);
            patch = compositeArea.getPatchUnderPoint(local.x, local.y);
            if (patch) {
                local = patch.globalToLocal(event.stageX, event.stageY);
                if (port.portType === 'input') {
                    hitPort = patch.getOutputPortUnderPoint(local.x, local.y);
                } else {
                    hitPort = patch.getInputPortUnderPoint(local.x, local.y);
                }
                if (hitPort) {
                    port.connect(hitPort);
                }
            }

            event.stopPropagation();
        }
        function onPressMove(event) {
            if (port.portType === 'input') {
                activeConnection.outputX = event.stageX;
                activeConnection.outputY = event.stageY;
            } else {
                activeConnection.inputX = event.stageX;
                activeConnection.inputY = event.stageY;
            }

            event.stopPropagation();
        }
        function onDoubleClick(event) {
            disconnect();
        }
        function connect(peer) {
            var myPatch, peerPatch;

            if (port.peers.indexOf(peer) === -1) {
                port.peers.push(peer);
                peer.peers.push(port);

                myPatch = port.parent.parent;
                peerPatch = peer.parent.parent;

                if (port.portType === 'input') {
                    peerPatch.node.connect(myPatch.node, peer.channel, port.channel);
                } else {
                    myPatch.node.connect(peerPatch.node, port.channel, peer.channel);
                }
            }
        }
        function disconnect() {
            var i, j, peer, patch;

            for (i = 0; i < port.peers.length; i++) {
                peer = port.peers[i];
                peer.peers.splice(peer.peers.indexOf(port), 1);
            }

            if (port.portType === 'input') {
                for (i = 0; i < port.peers.length; i++) {
                    peer = port.peers[i];
                    peer.reconnect();
                }
            } else {
                patch = port.parent.parent;
                patch.node.disconnect(port.channel);
            }

            port.peers = [];
        }
        function reconnect() {
            var patch, peer, peerPatch, i;

            patch = port.parent.parent;
            patch.node.disconnect(port.channel);
            for (i = 0; i < port.peers.length; i++) {
                peer = port.peers[i];
                peerPatch = peer.parent.parent;
                patch.node.connect(peerPatch.node, port.channel, peer.channel);
            }
        }

        port = new Shape();
        port.portType = type;
        port.channel = channel;
        port.graphics.beginFill('#888').drawCircle(0, 0, PORT_RADIUS);
        port.setBounds(-PORT_RADIUS, -PORT_RADIUS, 2 * PORT_RADIUS, 2 * PORT_RADIUS);
        port.addEventListener('mousedown', onMouseDown);
        port.addEventListener('dblclick', onDoubleClick);
        port.peers = [];
        port.connect = connect;
        port.disconnect = disconnect;
        port.reconnect = reconnect;

        return port;
    }
    
    function drawConnection(graphics, outputX, outputY, inputX, inputY) {
        graphics.beginStroke('#fff')
            .setStrokeStyle(2)
            .moveTo(outputX, outputY)
            .bezierCurveTo(
                    outputX + Math.min(100, Math.abs(outputX - inputX)), outputY,
                    inputX - Math.min(100, Math.abs(outputY - inputY)), inputY,
                    inputX, inputY);
    }

    function isDeployed(object) {
        return compositeArea.contains(object);
    }

    function intersect(obj1, obj2) {
        var obj1_pos = obj1.localToGlobal(obj1.getBounds().x, obj1.getBounds().y);
        var obj2_pos = obj2.localToGlobal(obj2.getBounds().x, obj2.getBounds().y);
        var obj1_left = obj1_pos.x, obj1_right = obj1_pos.x + obj1.getBounds().width;
        var obj1_top = obj1_pos.y, obj1_bottom = obj1_pos.y + obj1.getBounds().height;
        var obj2_left = obj2_pos.x, obj2_right = obj2_pos.x + obj2.getBounds().width;
        var obj2_top = obj2_pos.y, obj2_bottom = obj2_pos.y + obj2.getBounds().height;
        return ((obj1_left <= obj2_left && obj2_left < obj1_right) || (obj1_left <= obj2_right && obj2_right < obj1_right)) &&
               ((obj1_top <= obj2_top && obj2_top < obj1_bottom) || (obj1_top <= obj2_bottom && obj2_bottom < obj1_bottom));
    }

    function setupViews() {

        function oscillator() {
            var i, inputs, node;
            node = audioContext.createOscillator();
            inputs = document.querySelectorAll('#oscillatorParams input[name=type]');
            for (i = 0; i < inputs.length; i++) {
                inputs[i].addEventListener('change', function(event) {
                    selectedPatch.node.type = event.target.value;
                });
            }
            document.querySelector('#oscillatorParams input[name=frequency]').min = node.frequency.minValue;
            document.querySelector('#oscillatorParams input[name=frequency]').max = node.frequency.maxValue;
            document.querySelector('#oscillatorParams input[name=frequency]').addEventListener('change', function(event) {
                document.querySelector('#oscillatorParams label[name=frequency]').innerText = event.target.value;
                selectedPatch.node.frequency.value = event.target.value;
            });
            document.querySelector('#oscillatorParams input[name=detune]').min = node.detune.minValue;
            document.querySelector('#oscillatorParams input[name=detune]').max = node.detune.maxValue;
            document.querySelector('#oscillatorParams input[name=detune]').addEventListener('change', function(event) {
                document.querySelector('#oscillatorParams label[name=detune]').innerText = event.target.value;
                selectedPatch.node.detune.value = event.target.value;
            });
        }
        function gain() {
            var node;
            node = audioContext.createGain();
            document.querySelector('#gainParams input[name=gain]').min = node.gain.minValue * 100;
            document.querySelector('#gainParams input[name=gain]').max = node.gain.maxValue * 100;
            document.querySelector('#gainParams input[name=gain]').addEventListener('change', function(event) {
                selectedPatch.node.gain.value = event.target.value / 100;
            });
        }
        function biquadFilter() {
            var i, inputs, node;
            node = audioContext.createBiquadFilter();
            inputs = document.querySelectorAll('#biquadFilterParams input[name=type]');
            for (i = 0; i < inputs.length; i++) {
                inputs[i].addEventListener('change', function(event) {
                    selectedPatch.node.type = event.target.value;
                });
            }
            document.querySelector('#biquadFilterParams input[name=frequency]').min = node.frequency.minValue;
            document.querySelector('#biquadFilterParams input[name=frequency]').max = node.frequency.maxValue;
            document.querySelector('#biquadFilterParams input[name=frequency]').addEventListener('change', function(event) {
                document.querySelector('#biquadFilterParams label[name=frequency]').innerText = event.target.value;
                selectedPatch.node.frequency.value = event.target.value;
            });
            document.querySelector('#biquadFilterParams input[name=detune]').min = node.detune.minValue;
            document.querySelector('#biquadFilterParams input[name=detune]').max = node.detune.maxValue;
            document.querySelector('#biquadFilterParams input[name=detune]').addEventListener('change', function(event) {
                document.querySelector('#biquadFilterParams label[name=detune]').innerText = event.target.value;
                selectedPatch.node.detune.value = event.target.value;
            });
            document.querySelector('#biquadFilterParams input[name=Q]').min = node.Q.minValue;
            document.querySelector('#biquadFilterParams input[name=Q]').max = node.Q.maxValue;
            document.querySelector('#biquadFilterParams input[name=Q]').addEventListener('change', function(event) {
                selectedPatch.node.Q.value = event.target.value;
            });
            document.querySelector('#biquadFilterParams input[name=gain]').min = node.gain.minValue;
            document.querySelector('#biquadFilterParams input[name=gain]').max = node.gain.maxValue;
            document.querySelector('#biquadFilterParams input[name=gain]').addEventListener('change', function(event) {
                selectedPatch.node.gain.value = event.target.value;
            });
        }
        function audioDestination() {
            document.querySelector('#audioDestinationParams label[name=maxChannelCount]').innerText = audioContext.destination.maxChannelCount;
        }

        oscillator();
        gain();
        biquadFilter();
        audioDestination();
    }

    function refreshPane(patch) {
        if (patch.nodeType === 'Oscillator') {
            document.querySelector('#oscillatorParams input[value=' + patch.node.type + ']').checked = 'checked';
            document.querySelector('#oscillatorParams input[name=frequency]').value = patch.node.frequency.value;
            document.querySelector('#oscillatorParams label[name=frequency]').innerText = patch.node.frequency.value;
            document.querySelector('#oscillatorParams input[name=detune]').value = patch.node.detune.value;
            document.querySelector('#oscillatorParams label[name=detune]').innerText = patch.node.detune.value;
        } else if (patch.nodeType === 'Gain') {
            document.querySelector('#gainParams input[name=gain]').value = patch.node.gain.value * 100;
        } else if (patch.nodeType === 'BiquadFilter') {
            document.querySelector('#biquadFilterParams input[value=' + patch.node.type + ']').checked = 'checked';
            document.querySelector('#biquadFilterParams input[name=frequency]').value = patch.node.frequency.value;
            document.querySelector('#biquadFilterParams label[name=frequency]').innerText = patch.node.frequency.value;
            document.querySelector('#biquadFilterParams input[name=detune]').value = patch.node.detune.value;
            document.querySelector('#biquadFilterParams label[name=detune]').innerText = patch.node.detune.value;
            document.querySelector('#biquadFilterParams input[name=Q]').value = patch.node.Q.value;
            document.querySelector('#biquadFilterParams input[name=gain]').value = patch.node.gain.value;
        }
    }

    setupStage();
    setupViews();
})();
