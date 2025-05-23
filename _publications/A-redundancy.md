---
title: "How redundant is the Transformer stack in speech representation models?"
collection: papers
permalink: /papers/redundancy
excerpt: "Authors: <i> Teresa Dorszewski*, <b>Albert Kjøller Jacobsen*</b>, Lenka Tětková, Lars Kai Hansen </i>"
date: 2025-04-06
venue: 'International Conference on Acoustics, Speech and Signal Processing (ICASSP)'
paperurl: 'https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=10887866'
# citation: ' Jacobsen, Albert Kjøller; Højbjerg, Phillip Chavarria; Jacobsen, Aron Djurhuus. (2022). &quot;Visual Question Answering with Knowledge-based Semantics.&quot; <i>DTU Department of Applied Mathematics and Computer Science </i>.'

---
<p style="text-align: justify"> 
Accepted for presentation at <i>International Conference on Acoustics, Speech and Signal Processing (ICASSP), 2025, Hyderabad, India.</i> The paper is available <a href="https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=10887866">here</a>. <br><br>

A <a href="https://neurips2024-enlsp.github.io/accepted_papers.html">workshop version</a> was presented at the <i>workshop on Efficient Natural Language and Speech Processing (ENLSP) @ NeurIPS, Vancouver, Canada, 2024</i>. It was runner up for the best short paper award.</p> 

Abstract 
======
<p style="text-align: justify"> Self-supervised speech representation models, particularly those leveraging transformer architectures, have demonstrated remarkable performance across various tasks such as speech recognition, speaker identification, and emotion detection. Recent studies on transformer models revealed high redundancy between layers and the potential for significant pruning, which we will investigate here for transformer-based speech representation models. We perform a detailed analysis of layer similarity in speech representation models using three similarity metrics: cosine similarity, centered kernel alignment, and mutual nearest-neighbor alignment. Our findings reveal a block-like structure of high similarity, suggesting two main processing steps and significant redundancy of layers. We demonstrate the effectiveness of pruning transformer-based speech representation models without the need for post-training, achieving up to 40% reduction in transformer layers while maintaining over 95% of the model’s predictive capacity. Furthermore, we employ a knowledge distillation method to substitute the entire transformer stack with mimicking layers, reducing the network size by 95-98% and the inference time by up to 94%. This substantial decrease in computational load occurs without considerable performance loss, suggesting that the transformer stack is almost completely redundant for downstream applications of speech representation models.</p> <br>
<img src='/images/papers/redundancy.png' alt='Main results figure of Transformer redundancy' style='display: block; margin-left: auto; margin-right: auto; max-width: 90%; height: auto;'>

Citation
=====
```
@inproceedings{dorszewski2025redundant,
  title={How Redundant Is the Transformer Stack in Speech Representation Models?},
  author={Dorszewski, Teresa and Jacobsen, Albert Kj{\o}ller and T{\v{e}}tkov{\'a}, Lenka and Hansen, Lars Kai},
  booktitle={ICASSP 2025-2025 IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)},
  pages={1--5},
  year={2025},
  organization={IEEE}
}
```