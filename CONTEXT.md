# Nexus Business Context

Nexus coordinates role-based task work and the payment-tracking lifecycle that follows selected design tasks.

## Payment Tracking

**Payment-tracking record**:
A product record that moves through information and selection, second stage, third stage, and summary.
_Avoid_: Payment task, draft

**Historical stage**:
An entered stage that precedes the record's current stage and is normally read-only.
_Avoid_: Old page

**Reopened stage**:
A historical stage temporarily made editable by an authorized user.
_Avoid_: Restored stage

**Restored process**:
An ended payment-tracking record returned to an in-progress state at the stage where it previously ended.
_Avoid_: Reopened process

**Downstream invalidation**:
The permanent business invalidation of every stage after a reopened stage when the revised branch explicitly ends at that stage. Invalidated stages are no longer part of the record's timeline.
_Avoid_: Hide later stages, rollback

**Stage-owned image**:
An image whose business meaning belongs to one specific payment-tracking stage or one adjustment within that stage.
_Avoid_: Record image
