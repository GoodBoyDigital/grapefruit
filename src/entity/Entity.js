(function() {
    //Features TODO:
    // * Methods (https://github.com/obiot/melonJS/blob/master/src/entity/entity.js)
    //      - flipX
    //      - flipY
    //      - doWalk
    //      - doClimb
    //      - doJump
    //      - forceJump
    //      - checkSlope
    //      - updateMovement (slopes/breakable tiles)
    gf.Entity = gf.Sprite.extend({
        //initializes a new entity with the start position (pos)
        //and properties (settings). Many of these properties can
        //be specified in Tiled.
        init: function(pos, settings) {
            /****************************************************************************
             * Properties that are defined in the `settings` object,
             * these can be specified in the properties of the object layer
             * in Tiled, and overriden on a per-object basis
             ****************************************************************************/
            this.type = gf.types.ENTITY.NEUTRAL;

            //scale of the entity
            this.scale = 1;

            //can collide with other entities
            this.isCollidable = true;

            //can collide with the map when moving
            this.isMapCollidable = true;

            //is the entity visible
            this.isVisible = true;

            //is an entity
            this.isEntity = true;

            //you can still set these in Tiled by using "x|y" notation
            //velocity of the entity (units per tick)
            this.velocity = new gf.Vector(0, 0);

            //max velocity to cap the entity at (units per tick)
            this.maxVelocity = new gf.Vector(15, 15);

            //acceleration of the entity when moving (units per second)
            this.accel = new gf.Vector(250, 250);

            //size of the hitbox
            this.hitSize = new gf.Vector(0, 0);

            //offset from the center to have the hitbox NOT IMPLEMENTED
            this.hitOffset = new gf.Vector(0, 0);

            //the name of this entitiy
            this.name = '';

            //friction to apply to this entities movement
            this.friction = settings.friction || gf.game.friction;

            //gravity of the world
            this.gravity = settings.gravity || gf.game.gravity;

            //entity alive
            this.alive = true;

            //entity falling (read only)
            this.falling = false;

            //entity jumping (read only)
            this.jumping = false;

            /****************************************************************************
             * Call base constructor
             ****************************************************************************/
            this._super(settings);

            /****************************************************************************
             * Create the actual object for the scene
             ****************************************************************************/
            //if the hitbox size isn't set, use the same as normal size
            if(this.hitSize.x === 0 && this.hitSize.y === 0)
                this.hitSize = this.size.clone();

            //scale size vectors
            this.scaledSize = this.size.clone().multiplyScalar(this.scale);
            this.scaledHitSize = this.hitSize.clone().multiplyScalar(this.scale);
            this.scaledHitOffset = this.hitOffset.clone().multiplyScalar(this.scale);

            //create main entity mesh
            this._createMesh();

            //create a second mesh for the hitbox
            this._createHitboxMesh();

            //set default position
            this.setPosition(pos);
        },
        //calculates distance between this object and another
        distanceTo: function(obj) {
            var dx = this._hitboxMesh.position.x - entity._hitboxMesh.position.x,
                dy = this._hitboxMesh.position.y - entity._hitboxMesh.position.y;

            return Math.sqrt(dx*dx + dy*dy);
        },
        //computes the velocity taking into account gravity, friction, etc
        computeVelocity: function(vel) {
            //apply gravity
            if(this.gravity) {
                vel.y -= !this.onladder ? (this.gravity * gf.game._delta) : 0;

                //check if falling/jumping
                this.falling = (vel.y > 0);
                this.jumping = this.falling ? false : this.jumping;
            }

            //apply friction
            if(this.friction.x) vel.x = gf.utils.applyFriction(vel.x, this.friction.x);
            if(this.friction.y) vel.y = gf.utils.applyFriction(vel.y, this.friction.y);

            //cap velocity
            if(vel.x) vel.x = gf.utils.clamp(vel.x, -this.maxVelocity.x, this.maxVelocity.x);
            if(vel.y) vel.y = gf.utils.clamp(vel.y, -this.maxVelocity.y, this.maxVelocity.y);

            return this;
        },
        //from http://gamedev.stackexchange.com/questions/586/what-is-the-fastest-way-to-work-out-2d-bounding-box-intersection
        intersects: function(entity)  {
            return (Math.abs(this._hitboxMesh.position.x - entity._hitboxMesh.position.x) * 2 < (this.hitSize.x + entity.hitSize.x)) && 
                    (Math.abs(this._hitboxMesh.position.y - entity._hitboxMesh.position.y) * 2 < (this.hitSize.y + entity.hitSize.y));
        },
        checkCollision: function(entity) {
            //response vector
            var p = new gf.Vector(0, 0);

            //check if hitboxes intersect
            if (this.intersects(entity)) {
                //compute delta between this & entity
                var dx = this._hitboxMesh.position.x - entity._hitboxMesh.position.x,
                    dy = this._hitboxMesh.position.y - entity._hitboxMesh.position.y;

                //compute penetration depth for both axis
                p.x = dx / 2;
                p.y = dy / 2;

                //check and "normalize" axis
                /*if (p.x < p.y) {
                    p.y = 0;
                    p.x = dx < 0 ? -p.x : p.x;
                } else {
                    p.x = 0;
                    p.y = dy < 0 ? -p.y : p.y;
                }*/
            }

            return p;
        },
        addToScene: function(scene) {
            if(this._hitboxMesh) scene.add(this._hitboxMesh);

            return this._super(scene);
        },
        removeFromScene: function(scene) {
            if(this._hitboxMesh) scene.remove(this._hitboxMesh);

            return this._super(scene);
        },
        addToPool: function(name) {
            return gf.entityPool.add(name || this.name, this);
        },
        updateMovement: function() {
            if(this.velocity.x === 0 && this.velocity.y === 0) return;

            var colliders = gf.game.world !== undefined ? gf.game.world.checkCollision(this._hitboxMesh, this.scaledHitSize, this.velocity) : [];

            //update flags
            this.onladder = false;

            //collisions
            var self = this;
            for(var i = 0, il = colliders.length; i < il; ++i) {
                var collider = colliders[i],
                    tile = collider.tile,
                    axis = collider.axis;

                self.onladder = (tile.type == gf.types.COLLISION.LADDER ? true : self.onladder);

                //if a solid tile
                if(tile.type == gf.types.COLLISION.SOLID) {
                    //if it is a slope, apply the normal
                    if(tile.normal && (!self.velocity.x || !self.velocity.y)) {
                        var badMovement = tile.normal.clone().multiplyScalar(self.velocity.dot(tile.normal)),
                            newMovement = self.velocity.clone().sub(badMovement);

                        self.velocity.add(newMovement);
                        return false;
                    }
                    //otherwise just stop movement
                    else {
                        self.velocity[axis] = 0;
                    }
                }
            }

            //TODO: Edge rolling (if you are on the tip edge of a blocking tile, roll around it)

            //apply gravity, friction, etc to this velocity
            this.computeVelocity(this.velocity);

            //do the actual entity movement
            this.moveEntity();

            gf.debug._playerColliders = colliders;
            gf.debug._playerColliders.dirty = true;

            return colliders;
        },
        moveEntity: function(vel) {
            //optionally override current velocity
            vel = vel || this.velocity;

            if(vel.x === 0 && vel.y === 0) return;

            //update the entity position
            this._mesh.position.x += vel.x;
            this._mesh.position.y += vel.y;
            //this._mesh.translateX(vel.x);
            //this._mesh.translateY(vel.y);

            //also update the hitbox mesh if it is different
            if(this._hitboxMesh) {
                this._hitboxMesh.position.x += vel.x;
                this._hitboxMesh.position.y += vel.y;
                //this._hitboxMesh.translateX(vel.x);
                //this._hitboxMesh.translateY(vel.y);
            }

            //onMove event
            this.onMove(vel);

            //emit movement
            gf.event.publish(gf.types.EVENT.ENTITY_MOVE + '.' + this.id, vel);

            return this;
        },
        //On Collision Event
        // called when this object is collided into by another, by default if something collides with
        // a collectable entity we remove the collectable
        //vec - Collision Vector (gf.Vector)
        //obj - Colliding object (gf.Entity)
        onCollision: function(vec, obj) {
            if(this.collidable && this.type == gf.types.ENTIY.COLLECTABLE)
                gf.game.removeObject(this);

            return this;
        },
        //On Move Event
        // called when this entity moves
        //vel - Velocity the entity moved (gf.Vector)
        onMove: function(vel) {
            return this;
        },
        //On Tile Break Event
        // called when a tile is broken
        //tile - the tile that is broken
        onTileBreak: function(tile) {
            return this;
        },
        //set the position of this object in the scene
        setPosition: function(x, y) {
            this._super(x, y);

            if(x instanceof gf.Vector) {
                this._hitboxMesh.position.x = x.x;
                this._hitboxMesh.position.y = x.y;
            } else if(x instanceof Array) {
                this._hitboxMesh.position.x = x[0];
                this._hitboxMesh.position.y = x[1];
            } else {
                this._hitboxMesh.position.x = x;
                this._hitboxMesh.position.y = y;
            }

            if(this.hitOffset) {
                this._hitboxMesh.position.x += this.hitOffset.x;
                this._hitboxMesh.position.y += this.hitOffset.y;
            }

            return this;
        },
        //Privates
        _createMesh: function() {
            if(this._mesh) return;

            this._materials = [];

            this._materials.push(new THREE.MeshBasicMaterial({ transparent: true }));

            //add outline material if needed
            /*if(gf.debug.showOutline) {
                this._materials.push(new THREE.MeshBasicMaterial({
                    color: gf.debug.outlineColor,
                    wireframe: true,
                    wireframeLinewidth: 1
                }));
            }*/

            this._geom = new THREE.PlaneGeometry(this.scaledSize.x, this.scaledSize.y);
            this._mesh = THREE.SceneUtils.createMultiMaterialObject(this._geom, this._materials);//new THREE.Mesh(this._geom, this._materials);

            //multimaterials object doesn't have .geometry defined
            this._mesh.geometry = this._geom;

            //set visible
            //this._mesh.visible = this.isVisible;
        },
        _createHitboxMesh: function() {
            if(this._hitboxMesh) return;

            this._hitboxMaterial = new THREE.MeshBasicMaterial({
                color: gf.debug.hitboxColor,
                wireframe: gf.debug.showHitbox,
                wireframeLinewidth: 1,
                transparent: true,
                opacity: gf.debug.showHitbox ? 0.8 : 0
            });

            this._hitboxGeom = new THREE.PlaneGeometry(1, 1);

            this._hitboxMesh = new THREE.Mesh(this._hitboxGeom, this._hitboxMaterial);
            this._hitboxMesh.scale.set(this.scaledHitSize.x, this.scaledHitSize.y, 1);
        },
    });
})();